import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from configuration.business_day import business_day_start_hour, forget_business_day_start_hour
from icard.testing import create_admin, create_role_member, seed_roles
from orders.models import Order, OrderStatus
from payments.models import Bill, BillStatus, CashClosing, PaymentMethod
from payments.test_cash_closing import add_payment, add_reversal
from products.service_day import DayRange, dashboard_periods, service_day_range
from reports.dashboard import dashboard
from tables.models import Table
from users.roles import CASHIER_ROLE, KITCHEN_ROLE, WAITER_ROLE

DASHBOARD_URL = '/api/reports/dashboard/'
BOGOTA = ZoneInfo('America/Bogota')
WEDNESDAY = datetime.date(2026, 11, 11)
NOW = datetime.datetime(2026, 11, 11, 21, tzinfo=BOGOTA)


def day(month: int, number: int) -> datetime.date:
    return datetime.date(2026, month, number)


def at(date: datetime.date, hour: int) -> datetime.datetime:
    return datetime.datetime.combine(date, datetime.time(hour), tzinfo=BOGOTA)


class PeriodTests(SimpleTestCase):
    def test_today_this_week_and_this_month_against_the_same_stretch_before(self) -> None:
        periods = dashboard_periods(WEDNESDAY)

        self.assertEqual(periods['today'].current, DayRange(day(11, 11), day(11, 12)))
        self.assertEqual(periods['today'].previous, DayRange(day(11, 4), day(11, 5)))
        self.assertEqual(periods['week'].current, DayRange(day(11, 9), day(11, 12)))
        self.assertEqual(periods['week'].previous, DayRange(day(11, 2), day(11, 5)))
        self.assertEqual(periods['month'].current, DayRange(day(11, 1), day(11, 12)))
        self.assertEqual(periods['month'].previous, DayRange(day(10, 1), day(10, 12)))

    def test_a_long_month_is_compared_with_the_whole_shorter_month(self) -> None:
        periods = dashboard_periods(datetime.date(2026, 3, 31))

        self.assertEqual(periods['month'].previous, DayRange(day(2, 1), day(3, 1)))


class ServiceDayBoundsTests(APITestCase):
    def setUp(self) -> None:
        forget_business_day_start_hour()
        self.addCleanup(forget_business_day_start_hour)

    def test_a_service_day_runs_from_five_to_five(self) -> None:
        start, end = service_day_range(WEDNESDAY).bounds()

        self.assertEqual(start, at(WEDNESDAY, 5))
        self.assertEqual(end, at(day(11, 12), 5))


class DashboardTestCase(APITestCase):
    def setUp(self) -> None:
        seed_roles()
        forget_business_day_start_hour()
        self.addCleanup(forget_business_day_start_hour)
        self.admin = create_admin()

    @staticmethod
    def _paid_bill(subtotal: str, closed_at: datetime.datetime) -> Bill:
        return Bill.objects.create(
            table_number=1, status=BillStatus.PAID, subtotal=Decimal(subtotal), closed_at=closed_at
        )


class SalesTests(DashboardTestCase):
    def test_sold_is_money_received_by_payment_date(self) -> None:
        add_payment(PaymentMethod.CASH, '30000', tip='3000', at=at(WEDNESDAY, 13))
        add_payment(PaymentMethod.CARD, '20000', at=at(day(11, 12), 1))
        add_reversal(add_payment(PaymentMethod.CASH, '5000', at=at(WEDNESDAY, 14)), at=at(WEDNESDAY, 15))
        add_payment(PaymentMethod.CASH, '99000', at=at(WEDNESDAY, 4))

        today = dashboard(at(day(11, 12), 2))['sales']['today']

        self.assertEqual(today['total'], '50000.00')
        self.assertEqual(today['tips'], '3000.00')

    def test_compares_with_the_same_day_last_week(self) -> None:
        add_payment(PaymentMethod.CASH, '12000', at=at(WEDNESDAY, 13))
        add_payment(PaymentMethod.CASH, '10000', at=at(day(11, 4), 13))

        today = dashboard(NOW)['sales']['today']

        self.assertEqual(today['previous_total'], '10000.00')
        self.assertEqual(today['change_percent'], '20.0')

    def test_no_previous_sales_gives_no_percentage(self) -> None:
        add_payment(PaymentMethod.CASH, '12000', at=at(WEDNESDAY, 13))

        self.assertIsNone(dashboard(NOW)['sales']['today']['change_percent'])

    def test_week_and_month_add_up_their_days_to_date(self) -> None:
        add_payment(PaymentMethod.CASH, '1000', at=at(day(11, 9), 13))
        add_payment(PaymentMethod.CASH, '2000', at=at(day(11, 2), 13))
        add_payment(PaymentMethod.CASH, '4000', at=at(day(10, 10), 13))
        add_payment(PaymentMethod.CASH, '8000', at=at(day(10, 31), 13))

        sales = dashboard(NOW)['sales']

        self.assertEqual(sales['week']['total'], '1000.00')
        self.assertEqual(sales['month']['total'], '3000.00')
        self.assertEqual(sales['month']['previous_total'], '4000.00')

    def test_average_ticket_is_consumption_per_closed_bill(self) -> None:
        self._paid_bill('30000', at(WEDNESDAY, 13))
        self._paid_bill('10000', at(WEDNESDAY, 14))
        Bill.objects.create(table_number=2, subtotal=Decimal('90000'))

        today = dashboard(NOW)['sales']['today']

        self.assertEqual((today['bills'], today['average_ticket']), (2, '20000.00'))

    def test_without_bills_the_average_ticket_is_zero(self) -> None:
        self.assertEqual(dashboard(NOW)['sales']['today']['average_ticket'], '0.00')


class RightNowTests(DashboardTestCase):
    def test_counts_open_tables_and_orders_in_the_kitchen(self) -> None:
        table = Table.objects.create(number=1)
        Table.objects.create(number=2)
        bill = Bill.objects.create(table=table, table_number=1)
        for order_status in (OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY):
            Order.objects.create(table=table, bill=bill, status=order_status)

        data = dashboard(NOW)

        self.assertEqual((data['open_tables'], data['tables'], data['orders_in_kitchen']), (1, 2, 2))

    def test_cash_register_open_until_closed(self) -> None:
        self.assertEqual(dashboard()['cash_register'], {'closed': False})

    def test_warns_about_payments_after_the_closing(self) -> None:
        now = timezone.now()
        closing = CashClosing.objects.create(
            service_day=dashboard(now)['service_day'], closed_at=now, closed_by=self.admin
        )
        add_payment(PaymentMethod.CASH, '1000', at=now + datetime.timedelta(minutes=1))

        register = dashboard(now + datetime.timedelta(minutes=2))['cash_register']

        self.assertTrue(register['closed'])
        self.assertEqual(register['closed_at'], closing.closed_at)
        self.assertEqual(register['payments_after'], 1)


class DashboardApiTests(DashboardTestCase):
    def test_admin_gets_the_dashboard(self) -> None:
        self.client.force_authenticate(self.admin)

        response = self.client.get(DASHBOARD_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data['sales']), {'today', 'week', 'month'})

    def test_only_the_admin_sees_it(self) -> None:
        self.assertEqual(self.client.get(DASHBOARD_URL).status_code, status.HTTP_401_UNAUTHORIZED)
        for role in (WAITER_ROLE, KITCHEN_ROLE, CASHIER_ROLE):
            with self.subTest(role=role):
                self.client.force_authenticate(create_role_member(role))
                self.assertEqual(self.client.get(DASHBOARD_URL).status_code, status.HTTP_403_FORBIDDEN)

    def test_the_number_of_queries_does_not_grow_with_the_data(self) -> None:
        self.client.force_authenticate(self.admin)
        business_day_start_hour()

        def count_queries() -> int:
            with CaptureQueriesContext(connection) as queries:
                self.client.get(DASHBOARD_URL)
            return len(queries)

        before = count_queries()
        for amount in ('1000', '2000', '3000'):
            add_payment(PaymentMethod.CASH, amount)
            self._paid_bill(amount, timezone.now())

        self.assertEqual(count_queries(), before)
