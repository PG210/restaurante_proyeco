import uuid

from django.db.models import Count, Q, QuerySet
from django.utils import timezone

from orders.models import OrderStatus
from tables.models import Table

SUMMARY_STATUSES = {
    'pending': OrderStatus.PENDING,
    'preparing': OrderStatus.PREPARING,
    'ready': OrderStatus.READY,
}


class TableNotFoundError(Exception):
    pass


class TableClosedError(Exception):
    pass


def tables_with_open_orders_summary() -> QuerySet:
    counters = {
        field: Count('order', filter=Q(order__status=order_status, order__close=False))
        for field, order_status in SUMMARY_STATUSES.items()
    }
    return Table.objects.annotate(**counters).order_by('number')


def get_table_by_token(raw_token: str) -> Table:
    try:
        token = uuid.UUID(str(raw_token))
    except ValueError as error:
        raise TableNotFoundError from error
    try:
        return Table.objects.get(token=token)
    except Table.DoesNotExist as error:
        raise TableNotFoundError from error


def get_open_table_by_token(raw_token: str) -> Table:
    table = get_table_by_token(raw_token)
    if not table.is_open:
        raise TableClosedError
    return table


def open_table(table: Table) -> Table:
    if not table.is_open:
        table.is_open = True
        table.opened_at = timezone.now()
        table.save(update_fields=['is_open', 'opened_at'])
    return table


def close_table(table: Table) -> Table:
    table.is_open = False
    table.opened_at = None
    table.bill_requested_at = None
    table.save(update_fields=['is_open', 'opened_at', 'bill_requested_at'])
    return table


def regenerate_token(table: Table) -> Table:
    table.token = uuid.uuid4()
    table.save(update_fields=['token'])
    return table


def request_bill(table: Table) -> Table:
    if not table.is_open:
        raise TableClosedError
    if table.bill_requested_at is None:
        table.bill_requested_at = timezone.now()
        table.save(update_fields=['bill_requested_at'])
    return table


def attend_bill_request(table: Table) -> Table:
    table.bill_requested_at = None
    table.save(update_fields=['bill_requested_at'])
    return table
