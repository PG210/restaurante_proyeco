from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from orders.history import NEW_ORDER, record_status_changes
from orders.models import OPEN_ORDER_STATUSES, Order, OrderModifier, OrderStatus
from orders.permissions import CANCEL_ORDER, DELIVER_ORDER, PREPARE_ORDER, qualified_permission
from payments.services import get_or_create_open_bill, initial_order_status
from products.models import Modifier, Product
from products.modifiers import unit_price
from products.stock import adjust_for_quantity_change, release_for_order, reserve_for_orders
from tables.models import Table
from users.models import User
from users.permissions import user_has_permission

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
    modifiers: tuple[Modifier, ...] = ()


def create_orders(table: Table, items: list[OrderItem], user: User | None) -> list[Order]:
    with transaction.atomic():
        bill = get_or_create_open_bill(table)
        status = initial_order_status(bill)
        now = timezone.now()
        kitchen_at = now if status == OrderStatus.PENDING else None
        orders = [
            Order(
                table=table,
                bill=bill,
                status=status,
                product=item.product,
                quantity=item.quantity,
                notes=item.notes,
                price=unit_price(item.product, item.modifiers),
                preparation_minutes=item.product.preparation_time,
                kitchen_at=kitchen_at,
                created_by=user,
            )
            for item in items
        ]
        created = Order.objects.bulk_create(orders)
        OrderModifier.objects.bulk_create(
            OrderModifier(
                order=order,
                modifier=modifier,
                group_name=modifier.group.name,
                modifier_name=modifier.name,
                price_delta=modifier.price_delta,
            )
            for order, item in zip(created, items, strict=True)
            for modifier in item.modifiers
        )
        reserve_for_orders(created, user)
        record_status_changes(((order.pk, NEW_ORDER) for order in created), status, user, now)
        return created


def update_order(order: Order, quantity: int, notes: str, user: User) -> Order:
    with transaction.atomic():
        locked_order = _lock(order)
        if locked_order.status != OrderStatus.PENDING:
            raise OrderTransitionError('Solo se pueden modificar pedidos pendientes.')
        adjust_for_quantity_change(locked_order, quantity, user)
        locked_order.quantity = quantity
        locked_order.notes = notes
        locked_order.save(update_fields=['quantity', 'notes', 'updated_at'])
        return locked_order


def delete_order(order: Order, user: User) -> None:
    with transaction.atomic():
        locked_order = _lock(order)
        if locked_order.status in OPEN_ORDER_STATUSES:
            release_for_order(locked_order, user)
        locked_order.delete()


def advance_order(order: Order, user: User) -> Order:
    with transaction.atomic():
        locked_order = _lock(order)
        return _set_status(locked_order, _next_status_for(locked_order, user), user)


def advance_orders(order_ids: list[int], user: User) -> list[Order]:
    with transaction.atomic():
        orders = list(Order.objects.select_for_update().filter(pk__in=order_ids).order_by('pk'))
        missing_ids = sorted(set(order_ids) - {order.pk for order in orders})
        if missing_ids:
            raise OrderNotFoundError(f'Pedidos inexistentes: {", ".join(map(str, missing_ids))}.')
        target_statuses = [_next_status_for(order, user) for order in orders]
        updated_at = timezone.now()
        for target_status in set(target_statuses):
            record_status_changes(
                (
                    (order.pk, order.status)
                    for order, status in zip(orders, target_statuses, strict=True)
                    if status == target_status
                ),
                target_status,
                user,
                updated_at,
            )
        for order, target_status in zip(orders, target_statuses, strict=True):
            order.status = target_status
            order.updated_at = updated_at
        Order.objects.bulk_update(orders, ['status', 'updated_at'])
    return orders


def cancel_order(order: Order, reason: str, user: User) -> Order:
    with transaction.atomic():
        locked_order = _lock(order)
        if locked_order.status not in OPEN_ORDER_STATUSES:
            raise OrderTransitionError(f'Un pedido {locked_order.get_status_display()} no se puede cancelar.')
        if locked_order.payment_id is not None:
            raise OrderTransitionError('El pedido ya está pagado. Anula su cobro antes de cancelarlo.')
        _ensure_transition_permission(user, OrderStatus.CANCELLED)
        locked_order.cancel_reason = reason
        release_for_order(locked_order, user)
        return _set_status(locked_order, OrderStatus.CANCELLED, user, extra_fields=('cancel_reason',))


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


def _set_status(order: Order, status: str, user: User, extra_fields: tuple[str, ...] = ()) -> Order:
    record_status_changes([(order.pk, order.status)], status, user)
    order.status = status
    order.save(update_fields=['status', 'updated_at', *extra_fields])
    return order
