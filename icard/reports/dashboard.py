"""Figures for the admin home page, grouped by service day.

"Sold" is money received: payments without tips, reversals subtracting, by payment date. It
includes prepaid orders of bills still open, so it can differ from the payments history, which
adds up closed bills.
"""

import datetime
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone

from orders.models import Order, OrderStatus
from payments.api.serializers import user_display_name
from payments.cash_register import todays_closing
from payments.models import ZERO, Bill, BillStatus, Payment
from payments.tax import to_money
from products.service_day import DayRange, current_service_day, dashboard_periods, service_day_range
from tables.models import Table

PERCENT = Decimal('100')
PERCENT_QUANTUM = Decimal('0.1')
COOKING_STATUSES = (OrderStatus.PENDING, OrderStatus.PREPARING)


def _window(day_range: DayRange, field: str) -> Q:
    start, end = day_range.bounds()
    return Q(**{f'{field}__gte': start, f'{field}__lt': end})


def _change_percent(current: Decimal, previous: Decimal) -> str | None:
    if previous == ZERO:
        return None
    return str(((current - previous) / previous * PERCENT).quantize(PERCENT_QUANTUM))


def _sales(today: datetime.date) -> dict:
    periods = dashboard_periods(today)
    payment_sums = {}
    bill_sums = {}
    for key, period in periods.items():
        current = _window(period.current, 'created_at')
        payment_sums[f'{key}_total'] = Sum('amount', filter=current)
        payment_sums[f'{key}_tips'] = Sum('tip', filter=current)
        payment_sums[f'{key}_previous'] = Sum('amount', filter=_window(period.previous, 'created_at'))
        closed = _window(period.current, 'closed_at') & Q(status=BillStatus.PAID)
        bill_sums[f'{key}_bills'] = Count('id', filter=closed)
        bill_sums[f'{key}_consumed'] = Sum('subtotal', filter=closed)
    payments = Payment.objects.aggregate(**payment_sums)
    bills = Bill.objects.aggregate(**bill_sums)

    sales = {}
    for key in periods:
        total = to_money(payments[f'{key}_total'])
        previous = to_money(payments[f'{key}_previous'])
        bill_count = bills[f'{key}_bills']
        consumed = to_money(bills[f'{key}_consumed'])
        sales[key] = {
            'total': str(total),
            'previous_total': str(previous),
            'change_percent': _change_percent(total, previous),
            'tips': str(to_money(payments[f'{key}_tips'])),
            'bills': bill_count,
            'average_ticket': str(to_money(consumed / bill_count) if bill_count else ZERO),
        }
    return sales


def _cash_register(today: datetime.date, now: datetime.datetime) -> dict:
    closing = todays_closing(now)
    if closing is None:
        return {'closed': False}
    _, day_end = service_day_range(today).bounds()
    payments_after = Payment.objects.filter(created_at__gt=closing.closed_at, created_at__lt=day_end).count()
    return {
        'closed': True,
        'closed_at': closing.closed_at,
        'closed_by_name': user_display_name(closing.closed_by),
        'payments_after': payments_after,
    }


def dashboard(now: datetime.datetime | None = None) -> dict:
    now = now or timezone.now()
    today = current_service_day(now)
    return {
        'service_day': today,
        'sales': _sales(today),
        'open_tables': Bill.objects.filter(status=BillStatus.OPEN).count(),
        'tables': Table.objects.count(),
        'orders_in_kitchen': Order.objects.filter(status__in=COOKING_STATUSES).count(),
        'cash_register': _cash_register(today, now),
    }
