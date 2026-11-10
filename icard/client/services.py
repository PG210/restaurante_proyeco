from django.conf import settings
from django.db import transaction
from django.db.models import QuerySet

from orders.models import Order, OrderStatus
from orders.services import OrderItem, create_orders
from tables.models import Table


class ClientOrderLimitError(Exception):
    pass


def open_orders_for_table(table: Table) -> QuerySet:
    return Order.objects.filter(table=table, close=False).select_related('product').order_by('created_at')


def create_client_orders(table: Table, items: list[OrderItem]) -> list[Order]:
    with transaction.atomic():
        locked_table = Table.objects.select_for_update().get(pk=table.pk)
        pending_count = Order.objects.filter(
            table=locked_table, status=OrderStatus.PENDING, close=False
        ).count()
        if pending_count + len(items) > settings.CLIENT_MAX_PENDING_ORDERS_PER_TABLE:
            raise ClientOrderLimitError(
                'La mesa tiene demasiados pedidos pendientes. Llama al mesero para continuar.'
            )
        return create_orders(locked_table, items, user=None)
