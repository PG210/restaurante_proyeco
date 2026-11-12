import datetime

from orders.models import Order, OrderStatus, OrderStatusChange
from products.models import Product
from reports.kitchen import FORGOTTEN_MINUTES, kitchen_report
from reports.test_sales import TODAY, WEEK, SalesReportTestCase, at

KITCHEN = at(TODAY, 20)


def minutes(count: float) -> datetime.timedelta:
    return datetime.timedelta(minutes=count)


class KitchenReportTests(SalesReportTestCase):
    def _timed(
        self,
        product: Product,
        ready: float | None,
        preparing: float | None = None,
        delivered: float | None = None,
        estimate: int | None = None,
        kitchen_at: datetime.datetime = KITCHEN,
    ) -> Order:
        order = self._order(
            product, '1000.00', when=kitchen_at, kitchen_at=kitchen_at, preparation_minutes=estimate
        )
        steps = [
            (OrderStatus.PENDING, 0),
            (OrderStatus.PREPARING, preparing),
            (OrderStatus.READY, ready),
            (OrderStatus.DELIVERED, delivered),
        ]
        for status, offset in steps:
            if offset is not None:
                OrderStatusChange.objects.create(
                    order=order, to_status=status, changed_at=kitchen_at + minutes(offset)
                )
        return order

    def test_medians_leave_out_orders_marked_ready_hours_later(self) -> None:
        self._timed(self.coffee, ready=10, preparing=2, delivered=15)
        self._timed(self.coffee, ready=20, preparing=4)
        self._timed(self.coffee, ready=FORGOTTEN_MINUTES + 60)

        overall = kitchen_report(WEEK)['overall']

        self.assertEqual(overall['preparation'], {'count': 2, 'median': 15.0, 'average': 15.0})
        self.assertEqual(overall['wait'], {'count': 2, 'median': 3.0, 'average': 3.0})
        self.assertEqual(overall['delivery'], {'count': 1, 'median': 5.0, 'average': 5.0})
        self.assertEqual(overall['forgotten'], 1)

    def test_compares_each_product_with_its_estimate(self) -> None:
        self._timed(self.coffee, ready=10, estimate=10)
        self._timed(self.coffee, ready=20, estimate=10)
        self._timed(self.burger, ready=12)

        products = {row['name']: row for row in kitchen_report(WEEK)['products']}

        self.assertEqual(
            products['Café'],
            {
                'product_id': self.coffee.id,
                'name': 'Café',
                'measured': 2,
                'median': 15.0,
                'average': 15.0,
                'estimate': 10,
                'on_time_percent': 50.0,
                'review_estimate': True,
            },
        )
        self.assertIsNone(products['Hamburguesa']['estimate'])
        self.assertIsNone(products['Hamburguesa']['on_time_percent'])
        self.assertFalse(products['Hamburguesa']['review_estimate'])

    def test_a_close_enough_estimate_needs_no_review(self) -> None:
        self._timed(self.coffee, ready=12, estimate=10)

        [row] = kitchen_report(WEEK)['products']

        self.assertFalse(row['review_estimate'])
        self.assertEqual(row['on_time_percent'], 0.0)

    def test_leaves_out_orders_without_history_or_not_ready(self) -> None:
        self._order(self.coffee, '1000.00', kitchen_at=KITCHEN)
        self._timed(self.juice, ready=None, preparing=3)

        report = kitchen_report(WEEK)

        self.assertEqual(report['products'], [])
        self.assertEqual(report['overall']['preparation']['count'], 0)
        self.assertIsNone(report['overall']['preparation']['median'])

    def test_counts_from_the_last_time_it_entered_the_kitchen(self) -> None:
        order = self._timed(self.coffee, ready=None, kitchen_at=KITCHEN)
        later = KITCHEN + minutes(30)
        Order.objects.filter(pk=order.pk).update(kitchen_at=later)
        OrderStatusChange.objects.create(
            order=order, to_status=OrderStatus.READY, changed_at=later + minutes(8)
        )

        overall = kitchen_report(WEEK)['overall']

        self.assertEqual(overall['preparation']['median'], 8.0)

    def test_median_by_hour_the_order_entered_the_kitchen(self) -> None:
        self._timed(self.coffee, ready=10)
        self._timed(self.coffee, ready=30, kitchen_at=at(TODAY, 13, 30))

        by_hour = kitchen_report(WEEK)['by_hour']

        self.assertEqual(len(by_hour), 24)
        self.assertEqual(by_hour[20], {'hour': 20, 'count': 1, 'median': 10.0, 'average': 10.0})
        self.assertEqual(by_hour[13]['median'], 30.0)
        self.assertEqual(by_hour[9], {'hour': 9, 'count': 0, 'median': None, 'average': None})

    def test_says_since_when_times_are_measured(self) -> None:
        self.assertIsNone(kitchen_report(WEEK)['measured_since'])

        self._timed(self.coffee, ready=10)

        self.assertEqual(kitchen_report(WEEK)['measured_since'], TODAY)
