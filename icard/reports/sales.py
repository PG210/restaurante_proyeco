"""Where sales come from: products, categories, hours, staff and cancellations in a date range.

These reports measure consumption, not money received: order lines that were not cancelled
(`price x quantity`), dated by the service day in which the order was placed. They include
orders of bills still open, so they can differ from the dashboard and the payments history.

Orders do not keep the product name or category, so the current ones are shown.
"""

from decimal import Decimal

from django.db.models import BooleanField, Count, ExpressionWrapper, Q, QuerySet, Sum
from django.db.models.functions import Coalesce, ExtractHour, ExtractIsoWeekDay, Lower, Trim

from orders.models import Order, OrderStatus
from payments.api.serializers import user_display_name
from payments.models import ZERO, Payment
from payments.services import LINE_TOTAL
from payments.tax import to_money
from products.models import Product
from products.service_day import business_zone
from reports.ranges import ReportRange

PERCENT = Decimal('100')
SHARE_QUANTUM = Decimal('0.1')
RANKING_SIZE = 10
LATEST_CANCELLATIONS = 50
HOURS_IN_DAY = 24
WEEKDAYS = range(1, 8)

DELETED_PRODUCT = 'Producto eliminado'
NO_CATEGORY = 'Sin categoría'
MENU_CUSTOMER = 'Cliente (carta QR)'
NO_USER = 'Sin usuario'
NO_REASON = 'Sin motivo'


def _placed_in(report_range: ReportRange) -> QuerySet:
    start, end = report_range.bounds()
    return Order.objects.filter(created_at__gte=start, created_at__lt=end)


def _sold(report_range: ReportRange) -> QuerySet:
    return _placed_in(report_range).exclude(status=OrderStatus.CANCELLED).filter(price__isnull=False)


def _money(value: Decimal | None) -> str:
    return str(to_money(value))


def _share(amount: Decimal, total: Decimal) -> str:
    if total == ZERO:
        return str(ZERO.quantize(SHARE_QUANTUM))
    return str((amount / total * PERCENT).quantize(SHARE_QUANTUM))


def _person(first_name: str | None, last_name: str | None, email: str | None) -> str | None:
    if email is None:
        return None
    return f'{first_name} {last_name}'.strip() or email


def _range_info(report_range: ReportRange) -> dict:
    return {'first': report_range.first, 'last': report_range.last}


def products_report(report_range: ReportRange) -> dict:
    rows = list(
        _sold(report_range)
        .values('product_id', 'product__title', 'product__category__title')
        .annotate(units=Sum('quantity'), amount=Sum(LINE_TOTAL))
        .order_by('-amount', 'product__title')
    )
    total = sum((to_money(row['amount']) for row in rows), ZERO)
    products = [
        {
            'product_id': row['product_id'],
            'name': row['product__title'] or DELETED_PRODUCT,
            'category': _category_name(row['product_id'], row['product__category__title']),
            'units': row['units'],
            'amount': _money(row['amount']),
            'share': _share(to_money(row['amount']), total),
        }
        for row in rows
    ]
    existing = [product for product in products if product['product_id'] is not None]
    top = sorted(existing, key=lambda product: (-product['units'], -Decimal(product['amount'])))
    return {
        'range': _range_info(report_range),
        'total': _money(total),
        'units': sum(product['units'] for product in products),
        'products': products,
        'top': top[:RANKING_SIZE],
        'bottom': _least_sold(report_range),
    }


def _category_name(product_id: int | None, category: str | None) -> str:
    if product_id is None:
        return DELETED_PRODUCT
    return category or NO_CATEGORY


def _least_sold(report_range: ReportRange) -> list[dict]:
    """Active products with the fewest units, including the ones nobody ordered."""
    start, end = report_range.bounds()
    sold = Q(order__created_at__gte=start, order__created_at__lt=end, order__price__isnull=False) & ~Q(
        order__status=OrderStatus.CANCELLED
    )
    products = (
        Product.objects.filter(active=True)
        .annotate(units=Coalesce(Sum('order__quantity', filter=sold), 0))
        .order_by('units', 'title', 'id')
        .values('id', 'title', 'units')[:RANKING_SIZE]
    )
    return [{'product_id': row['id'], 'name': row['title'], 'units': row['units']} for row in products]


def categories_report(report_range: ReportRange) -> dict:
    has_product = ExpressionWrapper(Q(product__isnull=False), output_field=BooleanField())
    rows = list(
        _sold(report_range)
        .annotate(has_product=has_product)
        .values('product__category_id', 'product__category__title', 'has_product')
        .annotate(units=Sum('quantity'), amount=Sum(LINE_TOTAL))
        .order_by('-amount', 'product__category__title')
    )
    total = sum((to_money(row['amount']) for row in rows), ZERO)
    categories = [
        {
            'category_id': row['product__category_id'],
            'name': _category_label(row),
            'units': row['units'],
            'amount': _money(row['amount']),
            'share': _share(to_money(row['amount']), total),
        }
        for row in rows
    ]
    return {'range': _range_info(report_range), 'total': _money(total), 'categories': categories}


def _category_label(row: dict) -> str:
    if not row['has_product']:
        return DELETED_PRODUCT
    return row['product__category__title'] or NO_CATEGORY


def hours_report(report_range: ReportRange) -> dict:
    """Weekday (1 = Monday) by clock hour in the restaurant's time zone.

    It is the clock hour, not the service day: an order at 1:00 on Saturday is "Saturday 1:00"
    even though it belongs to Friday's service day.
    """
    zone = business_zone()
    rows = (
        _sold(report_range)
        .annotate(
            weekday=ExtractIsoWeekDay('created_at', tzinfo=zone), hour=ExtractHour('created_at', tzinfo=zone)
        )
        .values('weekday', 'hour')
        .annotate(orders=Count('id'), amount=Sum(LINE_TOTAL))
        .order_by('weekday', 'hour')
    )
    cells = [
        {
            'weekday': row['weekday'],
            'hour': row['hour'],
            'orders': row['orders'],
            'amount': to_money(row['amount']),
        }
        for row in rows
    ]
    by_hour = {hour: {'orders': 0, 'amount': ZERO} for hour in range(HOURS_IN_DAY)}
    by_weekday = {weekday: {'orders': 0, 'amount': ZERO} for weekday in WEEKDAYS}
    for cell in cells:
        for bucket in (by_hour[cell['hour']], by_weekday[cell['weekday']]):
            bucket['orders'] += cell['orders']
            bucket['amount'] += cell['amount']
    return {
        'range': _range_info(report_range),
        'cells': [{**cell, 'amount': _money(cell['amount'])} for cell in cells],
        'by_hour': [{'hour': hour, **_totals(bucket)} for hour, bucket in by_hour.items()],
        'by_weekday': [{'weekday': weekday, **_totals(bucket)} for weekday, bucket in by_weekday.items()],
    }


def _totals(bucket: dict) -> dict:
    return {'orders': bucket['orders'], 'amount': _money(bucket['amount'])}


def staff_report(report_range: ReportRange) -> dict:
    """Who placed the orders, and the tips of the payments each person took.

    No waiter is assigned to a table, so tips go to whoever charged, not to whoever served.
    """
    rows = (
        _sold(report_range)
        .values('created_by_id', 'created_by__first_name', 'created_by__last_name', 'created_by__email')
        .annotate(amount=Sum(LINE_TOTAL), lines=Count('id'), bills=Count('bill', distinct=True))
        .order_by('-amount', 'created_by__email')
    )
    total = sum((to_money(row['amount']) for row in rows), ZERO)
    staff = [
        {
            'user_id': row['created_by_id'],
            'name': _person(
                row['created_by__first_name'], row['created_by__last_name'], row['created_by__email']
            )
            or MENU_CUSTOMER,
            'amount': _money(row['amount']),
            'share': _share(to_money(row['amount']), total),
            'lines': row['lines'],
            'bills': row['bills'],
        }
        for row in rows
    ]
    return {
        'range': _range_info(report_range),
        'total': _money(total),
        'staff': staff,
        'tips': _tips_by_cashier(report_range),
    }


def _tips_by_cashier(report_range: ReportRange) -> list[dict]:
    start, end = report_range.bounds()
    rows = (
        Payment.objects.filter(created_at__gte=start, created_at__lt=end)
        .values('created_by_id', 'created_by__first_name', 'created_by__last_name', 'created_by__email')
        .annotate(tips=Sum('tip'), payments=Count('id', filter=Q(reverses__isnull=True)))
        .order_by('-tips', 'created_by__email')
    )
    return [
        {
            'user_id': row['created_by_id'],
            'name': _person(
                row['created_by__first_name'], row['created_by__last_name'], row['created_by__email']
            )
            or NO_USER,
            'tips': _money(row['tips']),
            'payments': row['payments'],
        }
        for row in rows
    ]


def cancellations_report(report_range: ReportRange, latest_limit: int | None = LATEST_CANCELLATIONS) -> dict:
    """Orders placed in the range and cancelled; the cancel time itself is not stored.

    `latest_limit=None` lists every cancelled order, for the download.
    """
    cancelled = _placed_in(report_range).filter(status=OrderStatus.CANCELLED)
    reasons = list(
        cancelled.annotate(reason_key=Lower(Trim('cancel_reason')))
        .values('reason_key')
        .annotate(count=Count('id'), units=Sum('quantity'), amount=Sum(LINE_TOTAL))
        .order_by('-count', 'reason_key')
    )
    products = (
        cancelled.values('product_id', 'product__title')
        .annotate(count=Count('id'), units=Sum('quantity'), amount=Sum(LINE_TOTAL))
        .order_by('-count', 'product__title')
    )
    latest = cancelled.select_related('product', 'table', 'created_by').order_by('-created_at', '-id')
    return {
        'range': _range_info(report_range),
        'count': sum(row['count'] for row in reasons),
        'units': sum(row['units'] for row in reasons),
        'amount': _money(sum((to_money(row['amount']) for row in reasons), ZERO)),
        'by_reason': [
            {
                'reason': _reason_label(row['reason_key']),
                'count': row['count'],
                'units': row['units'],
                'amount': _money(row['amount']),
            }
            for row in reasons
        ],
        'by_product': [
            {
                'product_id': row['product_id'],
                'name': row['product__title'] or DELETED_PRODUCT,
                'count': row['count'],
                'units': row['units'],
                'amount': _money(row['amount']),
            }
            for row in products
        ],
        'latest': [_cancelled_order(order) for order in latest[:latest_limit]],
    }


def _reason_label(reason_key: str) -> str:
    return reason_key[:1].upper() + reason_key[1:] if reason_key else NO_REASON


def _cancelled_order(order: Order) -> dict:
    return {
        'id': order.id,
        'created_at': order.created_at,
        'table_number': order.table.number if order.table else None,
        'product': order.product.title if order.product else DELETED_PRODUCT,
        'quantity': order.quantity,
        'amount': _money(order.price * order.quantity if order.price is not None else None),
        'reason': order.cancel_reason or NO_REASON,
        'placed_by': user_display_name(order.created_by) or MENU_CUSTOMER,
    }
