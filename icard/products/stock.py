import logging
from collections import Counter
from collections.abc import Iterable

from django.db import transaction
from django.db.models import IntegerField, OuterRef, QuerySet, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from products.models import Product, StockMovement, StockReason
from products.service_day import current_service_day

logger = logging.getLogger(__name__)

SALE_REASONS = (StockReason.ORDER, StockReason.ORDER_EDIT, StockReason.CANCEL)
PRODUCT_EDIT_NOTE = 'Edición del producto'


class StockError(Exception):
    pass


class InsufficientStockError(StockError):
    pass


class StockNotTrackedError(StockError):
    pass


def reserve_for_orders(orders: Iterable, user) -> None:
    orders = [order for order in orders if order.product_id is not None]
    demand = Counter()
    for order in orders:
        demand[order.product_id] += order.quantity
    products = {product.pk: product for product in _lock_tracked(demand)}
    for product_id, product in products.items():
        _ensure_enough(product, demand[product_id])

    movements = []
    for order in orders:
        product = products.get(order.product_id)
        if product is None:
            continue
        product.stock -= order.quantity
        movements.append(_movement(product, -order.quantity, StockReason.ORDER, user, order=order))
    for product in products.values():
        product.save(update_fields=['stock'])
    StockMovement.objects.bulk_create(movements)


def release_for_order(order, user) -> None:
    reserved = _reserved_units(order)
    if reserved <= 0:
        return
    product = _lock_tracked_product(order.product_id)
    if product is None:
        return
    product.stock += reserved
    product.save(update_fields=['stock'])
    StockMovement.objects.create(**_movement_fields(product, reserved, StockReason.CANCEL, user, order=order))


def adjust_for_quantity_change(order, new_quantity: int, user) -> None:
    difference = new_quantity - order.quantity
    if difference == 0 or _reserved_units(order) <= 0:
        return
    product = _lock_tracked_product(order.product_id)
    if product is None:
        return
    if difference > 0:
        _ensure_enough(product, difference)
    product.stock -= difference
    product.save(update_fields=['stock'])
    StockMovement.objects.create(
        **_movement_fields(product, -difference, StockReason.ORDER_EDIT, user, order=order)
    )


def add_stock(product: Product, units: int, user) -> Product:
    with transaction.atomic():
        locked = _lock_required(product)
        locked.stock += units
        locked.save(update_fields=['stock'])
        StockMovement.objects.create(**_movement_fields(locked, units, StockReason.RESTOCK, user))
    logger.info('Reposición de %s unidades del producto %s por usuario %s', units, locked.pk, user.pk)
    return locked


def set_stock(product: Product, units: int, note: str, user) -> Product:
    with transaction.atomic():
        locked = _lock_required(product)
        change = units - locked.stock
        locked.stock = units
        locked.save(update_fields=['stock'])
        StockMovement.objects.create(**_movement_fields(locked, change, StockReason.ADJUST, user, note=note))
    logger.info('Ajuste de stock del producto %s a %s por usuario %s', locked.pk, units, user.pk)
    return locked


def record_product_edit(previous_stock: int | None, product: Product, user) -> None:
    if previous_stock == product.stock:
        return
    change = (product.stock or 0) - (previous_stock or 0)
    StockMovement.objects.create(
        **_movement_fields(product, change, StockReason.ADJUST, user, note=PRODUCT_EDIT_NOTE)
    )


def with_sold_today(queryset: QuerySet) -> QuerySet:
    sales = (
        StockMovement.objects.filter(
            product=OuterRef('pk'), service_day=current_service_day(), reason__in=SALE_REASONS
        )
        .values('product')
        .annotate(total=Sum('change'))
        .values('total')
    )
    return queryset.annotate(
        sales_change_today=Coalesce(Subquery(sales, output_field=IntegerField()), Value(0))
    )


def _ensure_enough(product: Product, units: int) -> None:
    if product.stock < units:
        raise InsufficientStockError(f'Solo quedan {product.stock} de {product.title}.')


def _reserved_units(order) -> int:
    total = order.stock_movements.filter(reason__in=SALE_REASONS).aggregate(total=Sum('change'))['total']
    return -(total or 0)


def _lock_tracked(product_ids: Iterable[int]) -> list[Product]:
    locked = Product.objects.select_for_update().filter(pk__in=list(product_ids)).stock_tracked()
    return list(locked.order_by('pk'))


def _lock_tracked_product(product_id: int | None) -> Product | None:
    if product_id is None:
        return None
    return Product.objects.select_for_update().stock_tracked().filter(pk=product_id).first()


def _lock_required(product: Product) -> Product:
    locked = Product.objects.select_for_update().get(pk=product.pk)
    if not locked.tracks_stock:
        raise StockNotTrackedError(f'{locked.title} no tiene control de stock.')
    return locked


def _movement(product: Product, change: int, reason: str, user, **extra) -> StockMovement:
    return StockMovement(**_movement_fields(product, change, reason, user, **extra))


def _movement_fields(product: Product, change: int, reason: str, user, **extra) -> dict:
    return {
        'product': product,
        'change': change,
        'stock_after': product.stock,
        'reason': reason,
        'service_day': current_service_day(),
        'created_by': user if user is not None and user.is_authenticated else None,
        **extra,
    }
