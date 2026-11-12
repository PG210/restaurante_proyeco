"""How long the kitchen takes, from the order status history (phase 7c).

- Preparation: from entering the kitchen (`kitchen_at`) to the first "ready" after it.
- Wait: from entering the kitchen to "preparing". Delivery: from "ready" to "delivered".

Only orders with history count: older orders have no times and are left out. Times above
FORGOTTEN_MINUTES are most likely an order nobody marked in time; they are counted apart and
left out of the figures. Medians are the headline: one forgotten order does not move them.
"""

import datetime
import statistics
from collections import defaultdict
from dataclasses import dataclass

from django.db.models import Min, OuterRef, QuerySet, Subquery

from orders.models import Order, OrderStatus, OrderStatusChange
from products.service_day import business_zone
from reports.ranges import ReportRange
from reports.sales import DELETED_PRODUCT

FORGOTTEN_MINUTES = 240
REVIEW_ESTIMATE_RATIO = 1.25
MINUTES_DECIMALS = 1
HOURS_IN_DAY = 24
SECONDS_PER_MINUTE = 60


def _first_change_after_kitchen(status: str) -> Subquery:
    changes = OrderStatusChange.objects.filter(
        order=OuterRef('pk'), to_status=status, changed_at__gte=OuterRef('kitchen_at')
    ).order_by('changed_at', 'id')
    return Subquery(changes.values('changed_at')[:1])


def _measured_orders(report_range: ReportRange) -> QuerySet:
    start, end = report_range.bounds()
    return (
        Order.objects.filter(created_at__gte=start, created_at__lt=end, kitchen_at__isnull=False)
        .annotate(
            preparing_at=_first_change_after_kitchen(OrderStatus.PREPARING),
            ready_at=_first_change_after_kitchen(OrderStatus.READY),
            delivered_at=_first_change_after_kitchen(OrderStatus.DELIVERED),
        )
        .filter(ready_at__isnull=False)
        .values(
            'product_id',
            'product__title',
            'preparation_minutes',
            'kitchen_at',
            'preparing_at',
            'ready_at',
            'delivered_at',
        )
    )


def _minutes(start: datetime.datetime | None, end: datetime.datetime | None) -> float | None:
    if start is None or end is None:
        return None
    return (end - start).total_seconds() / SECONDS_PER_MINUTE


@dataclass(frozen=True)
class Timing:
    product_id: int | None
    product: str
    estimate: int | None
    kitchen_hour: int
    preparation: float
    wait: float | None
    delivery: float | None

    @property
    def on_time(self) -> bool | None:
        return None if self.estimate is None else self.preparation <= self.estimate


def _timing(row: dict) -> Timing:
    return Timing(
        product_id=row['product_id'],
        product=row['product__title'] or DELETED_PRODUCT,
        estimate=row['preparation_minutes'],
        kitchen_hour=row['kitchen_at'].astimezone(business_zone()).hour,
        preparation=_minutes(row['kitchen_at'], row['ready_at']),
        wait=_minutes(row['kitchen_at'], row['preparing_at']),
        delivery=_minutes(row['ready_at'], row['delivered_at']),
    )


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, MINUTES_DECIMALS)


def _usable(values: list[float | None]) -> list[float]:
    return [value for value in values if value is not None and value <= FORGOTTEN_MINUTES]


def _stats(values: list[float | None]) -> dict:
    usable = _usable(values)
    if not usable:
        return {'count': 0, 'median': None, 'average': None}
    return {
        'count': len(usable),
        'median': _round(statistics.median(usable)),
        'average': _round(statistics.fmean(usable)),
    }


def _on_time_percent(timings: list[Timing]) -> float | None:
    judged = [timing.on_time for timing in timings if timing.on_time is not None]
    if not judged:
        return None
    return _round(100 * sum(judged) / len(judged))


def _product_row(timings: list[Timing]) -> dict:
    preparation = _stats([timing.preparation for timing in timings])
    estimates = [timing.estimate for timing in timings if timing.estimate is not None]
    estimate = statistics.median(estimates) if estimates else None
    review = (
        estimate is not None
        and preparation['median'] is not None
        and preparation['median'] > estimate * REVIEW_ESTIMATE_RATIO
    )
    return {
        'product_id': timings[0].product_id,
        'name': timings[0].product,
        'measured': preparation['count'],
        'median': preparation['median'],
        'average': preparation['average'],
        'estimate': estimate,
        'on_time_percent': _on_time_percent(timings),
        'review_estimate': review,
    }


def kitchen_report(report_range: ReportRange) -> dict:
    timings = [_timing(row) for row in _measured_orders(report_range)]
    usable = [timing for timing in timings if timing.preparation <= FORGOTTEN_MINUTES]

    by_product = defaultdict(list)
    by_hour = defaultdict(list)
    for timing in usable:
        by_product[timing.product_id].append(timing)
        by_hour[timing.kitchen_hour].append(timing.preparation)

    products = sorted(
        (_product_row(product_timings) for product_timings in by_product.values()),
        key=lambda row: (-row['measured'], row['name']),
    )
    first_change = OrderStatusChange.objects.aggregate(first=Min('changed_at'))['first']
    return {
        'range': {'first': report_range.first, 'last': report_range.last},
        'measured_since': first_change.astimezone(business_zone()).date() if first_change else None,
        'overall': {
            'preparation': _stats([timing.preparation for timing in usable]),
            'wait': _stats([timing.wait for timing in usable]),
            'delivery': _stats([timing.delivery for timing in usable]),
            'on_time_percent': _on_time_percent(usable),
            'forgotten': len(timings) - len(usable),
        },
        'products': products,
        'by_hour': [{'hour': hour, **_stats(by_hour.get(hour, []))} for hour in range(HOURS_IN_DAY)],
    }
