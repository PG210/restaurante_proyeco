from django.db.models import Count, Q, QuerySet

from orders.models import OrderStatus
from tables.models import Table

SUMMARY_STATUSES = {
    'pending': OrderStatus.PENDING,
    'preparing': OrderStatus.PREPARING,
    'ready': OrderStatus.READY,
}


def tables_with_open_orders_summary() -> QuerySet:
    counters = {
        field: Count('order', filter=Q(order__status=order_status, order__close=False))
        for field, order_status in SUMMARY_STATUSES.items()
    }
    return Table.objects.annotate(**counters).order_by('number')
