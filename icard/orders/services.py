from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from orders.models import Order, OrderStatus
from orders.permissions import CANCEL_ORDER, DELIVER_ORDER, PREPARE_ORDER, qualified_permission
from products.models import Product
from tables.models import Table
from users.models import User
from users.permissions import user_has_permission

OPEN_STATUSES = (OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY)

NEXT_STATUS = {
    OrderStatus.PENDING: OrderStatus.PREPARING,
    OrderStatus.PREPARING: OrderStatus.READY,
    OrderStatus.READY: OrderStatus.DELIVERED,
}

TRANSITION_PERMISSIONS = {
    OrderStatus.PREPARING: PREPARE_ORDER,
    OrderStatus.READY: PREPARE_ORDER,
    OrderStatus.DELIVERED: DELIVER_ORDER,
    OrderStatus.CANCELLED: CANCEL_ORDER,
}


class OrderTransitionError(Exception):
    pass


class OrderPermissionError(Exception):
    pass


class OrderNotFoundError(Exception):
    pass


@dataclass(frozen=True)
class OrderItem:
    product: Product
    quantity: int
    notes: str


def create_orders(table: Table, items: list[OrderItem], user: User | None) -> list[Order]:
    orders = [
        Order(
            table=table,
            product=item.product,
            quantity=item.quantity,
            notes=item.notes,
            price=item.product.price,
            created_by=user,
        )
        for item in items
    ]
    with transaction.atomic():
        created_orders = Order.objects.bulk_create(orders)
    return created_orders


def advance_order(order: Order, user: User) -> Order:
    with transaction.atomic():
        locked_order = _lock(order)
        return _set_status(locked_order, _next_status_for(locked_order, user))


def advance_orders(order_ids: list[int], user: User) -> list[Order]:
    with transaction.atomic():
        orders = list(Order.objects.select_for_update().filter(pk__in=order_ids).order_by('pk'))
        missing_ids = sorted(set(order_ids) - {order.pk for order in orders})
        if missing_ids:
            raise OrderNotFoundError(f'Pedidos inexistentes: {", ".join(map(str, missing_ids))}.')
        target_statuses = [_next_status_for(order, user) for order in orders]
        updated_at = timezone.now()
        for order, target_status in zip(orders, target_statuses, strict=True):
            order.status = target_status
            order.updated_at = updated_at
        Order.objects.bulk_update(orders, ['status', 'updated_at'])
    return orders


def cancel_order(order: Order, reason: str, user: User) -> Order:
    with transaction.atomic():
        locked_order = _lock(order)
        if locked_order.status not in OPEN_STATUSES:
            raise OrderTransitionError(f'Un pedido {locked_order.get_status_display()} no se puede cancelar.')
        _ensure_transition_permission(user, OrderStatus.CANCELLED)
        locked_order.cancel_reason = reason
        return _set_status(locked_order, OrderStatus.CANCELLED, extra_fields=('cancel_reason',))


def _lock(order: Order) -> Order:
    return Order.objects.select_for_update().get(pk=order.pk)


def _next_status_for(order: Order, user: User) -> str:
    target_status = NEXT_STATUS.get(order.status)
    if target_status is None:
        raise OrderTransitionError(
            f'El pedido {order.pk} está {order.get_status_display()} y no puede avanzar.'
        )
    _ensure_transition_permission(user, target_status)
    return target_status


def _ensure_transition_permission(user: User, target_status: str) -> None:
    permission = qualified_permission(TRANSITION_PERMISSIONS[target_status])
    if not user_has_permission(user, permission):
        raise OrderPermissionError('No tienes permiso para realizar esta acción sobre el pedido.')


def _set_status(order: Order, status: str, extra_fields: tuple[str, ...] = ()) -> Order:
    order.status = status
    order.save(update_fields=['status', 'updated_at', *extra_fields])
    return order
