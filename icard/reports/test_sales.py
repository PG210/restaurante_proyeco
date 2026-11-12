import datetime
import io
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import status
from rest_framework.test import APITestCase

from categories.models import Category
from configuration.business_day import business_day_start_hour, forget_business_day_start_hour
from icard.testing import create_admin, create_member, create_role_member, seed_roles
from orders.models import Order, OrderStatus, OrderStatusChange
from payments.models import Bill, Payment, PaymentMethod
from products.models import Product
from reports import sales
from reports.ranges import MAX_RANGE_DAYS, ReportRange, ReportRangeError, report_range
from tables.models import Table
from users.roles import CASHIER_ROLE, WAITER_ROLE

BOGOTA = ZoneInfo('America/Bogota')
TODAY = datetime.date(2026, 11, 11)
WEEK = ReportRange(datetime.date(2026, 11, 5), TODAY)
FRIDAY = datetime.date(2026, 11, 6)
PRODUCT_IMAGE = 'products/test.png'


def at(date: datetime.date, hour: int, minute: int = 0) -> datetime.datetime:
    return datetime.datetime.combine(date, datetime.time(hour, minute), tzinfo=BOGOTA)


class ReportRangeTests(SimpleTestCase):
    def test_defaults_to_the_last_seven_days_including_today(self) -> None:
        self.assertEqual(report_range(TODAY), WEEK)

    def test_a_missing_start_is_a_week_before_the_end(self) -> None:
        last = datetime.date(2026, 10, 31)

        self.assertEqual(report_range(TODAY, last=last), ReportRange(datetime.date(2026, 10, 25), last))

    def test_rejects_an_inverted_range(self) -> None:
        with self.assertRaises(ReportRangeError):
            report_range(TODAY, TODAY, TODAY - datetime.timedelta(days=1))

    def test_accepts_a_whole_year_but_not_more(self) -> None:
        first = TODAY - datetime.timedelta(days=MAX_RANGE_DAYS - 1)

        self.assertEqual(report_range(TODAY, first, TODAY).first, first)
        with self.assertRaises(ReportRangeError):
            report_range(TODAY, first - datetime.timedelta(days=1), TODAY)


class SalesReportTestCase(APITestCase):
    def setUp(self) -> None:
        forget_business_day_start_hour()
        self.addCleanup(forget_business_day_start_hour)
        self.drinks = Category.objects.create(title='Bebidas', image='categories/test.png')
        self.food = Category.objects.create(title='Platos', image='categories/test.png')
        self.coffee = self._product('Café', self.drinks)
        self.juice = self._product('Jugo', self.drinks)
        self.burger = self._product('Hamburguesa', self.food)
        self.table = Table.objects.create(number=4)
        self.bill = Bill.objects.create(table=self.table, table_number=4)

    @staticmethod
    def _product(title: str, category: Category | None, active: bool = True) -> Product:
        return Product.objects.create(
            title=title, image=PRODUCT_IMAGE, price=Decimal('1.00'), category=category, active=active
        )

    def _order(
        self,
        product: Product | None,
        price: str,
        quantity: int = 1,
        when: datetime.datetime | None = None,
        status_: str = OrderStatus.DELIVERED,
        **fields,
    ) -> Order:
        order = Order.objects.create(
            product=product,
            table=self.table,
            bill=self.bill,
            price=Decimal(price),
            quantity=quantity,
            status=status_,
            **fields,
        )
        Order.objects.filter(pk=order.pk).update(created_at=when or at(TODAY, 20))
        order.refresh_from_db()
        return order


class ProductsReportTests(SalesReportTestCase):
    def test_adds_up_units_and_consumption_per_product(self) -> None:
        self._order(self.coffee, '3000.00', quantity=2)
        self._order(self.coffee, '3500.00')
        self._order(self.burger, '20000.00')

        report = sales.products_report(WEEK)

        self.assertEqual(report['total'], '29500.00')
        self.assertEqual(report['units'], 4)
        self.assertEqual(
            report['products'][0],
            {
                'product_id': self.burger.id,
                'name': 'Hamburguesa',
                'category': 'Platos',
                'units': 1,
                'amount': '20000.00',
                'share': '67.8',
            },
        )
        self.assertEqual(report['products'][1]['units'], 3)
        self.assertEqual(report['products'][1]['amount'], '9500.00')

    def test_leaves_out_cancelled_orders_and_orders_outside_the_range(self) -> None:
        self._order(self.coffee, '3000.00', status_=OrderStatus.CANCELLED)
        self._order(self.coffee, '3000.00', when=at(datetime.date(2026, 11, 5), 4, 59))
        self._order(self.coffee, '3000.00', when=at(datetime.date(2026, 11, 12), 5))
        self._order(self.juice, '4000.00', when=at(datetime.date(2026, 11, 12), 4, 59))

        report = sales.products_report(WEEK)

        self.assertEqual([row['name'] for row in report['products']], ['Jugo'])

    def test_groups_deleted_products_and_products_without_category(self) -> None:
        loose = self._product('Pan', None)
        self._order(loose, '1000.00')
        self._order(self.juice, '4000.00')
        self.juice.delete()

        rows = {row['name']: row for row in sales.products_report(WEEK)['products']}

        self.assertEqual(rows['Pan']['category'], 'Sin categoría')
        self.assertEqual(rows['Producto eliminado']['category'], 'Producto eliminado')

    def test_ranks_the_most_sold_by_units_and_the_least_sold_among_active_products(self) -> None:
        self._order(self.coffee, '3000.00', quantity=5)
        self._order(self.burger, '20000.00')
        self._product('Retirado', self.food, active=False)

        report = sales.products_report(WEEK)

        self.assertEqual([row['name'] for row in report['top']], ['Café', 'Hamburguesa'])
        self.assertEqual(
            report['bottom'],
            [
                {'product_id': self.juice.id, 'name': 'Jugo', 'units': 0},
                {'product_id': self.burger.id, 'name': 'Hamburguesa', 'units': 1},
                {'product_id': self.coffee.id, 'name': 'Café', 'units': 5},
            ],
        )


class CategoriesReportTests(SalesReportTestCase):
    def test_adds_up_each_category_and_keeps_deleted_products_apart(self) -> None:
        self._order(self.coffee, '3000.00', quantity=2)
        self._order(self.juice, '4000.00')
        self._order(self._product('Pan', None), '1000.00')
        gone = self._order(self.burger, '2000.00')
        gone.product.delete()

        report = sales.categories_report(WEEK)

        self.assertEqual(report['total'], '13000.00')
        rows = {row['name']: (row['units'], row['amount'], row['share']) for row in report['categories']}
        self.assertEqual(
            rows,
            {
                'Bebidas': (3, '10000.00', '76.9'),
                'Sin categoría': (1, '1000.00', '7.7'),
                'Producto eliminado': (1, '2000.00', '15.4'),
            },
        )


class HoursReportTests(SalesReportTestCase):
    def test_groups_by_weekday_and_hour_in_the_restaurant_zone(self) -> None:
        self._order(self.coffee, '3000.00', when=at(FRIDAY, 21, 10))
        self._order(self.juice, '4000.00', when=at(FRIDAY, 21, 50))
        self._order(self.burger, '20000.00', when=datetime.datetime(2026, 11, 7, 6, 30, tzinfo=datetime.UTC))

        report = sales.hours_report(WEEK)

        self.assertEqual(
            report['cells'],
            [
                {'weekday': 5, 'hour': 21, 'orders': 2, 'amount': '7000.00'},
                {'weekday': 6, 'hour': 1, 'orders': 1, 'amount': '20000.00'},
            ],
        )
        self.assertEqual(len(report['by_hour']), 24)
        self.assertEqual(report['by_hour'][21], {'hour': 21, 'orders': 2, 'amount': '7000.00'})
        self.assertEqual(report['by_weekday'][4], {'weekday': 5, 'orders': 2, 'amount': '7000.00'})
        self.assertEqual(report['by_weekday'][0], {'weekday': 1, 'orders': 0, 'amount': '0.00'})


class StaffReportTests(SalesReportTestCase):
    def test_credits_orders_to_who_placed_them_and_menu_orders_to_the_customer(self) -> None:
        waiter = create_member('waiter')
        waiter.first_name, waiter.last_name = 'Ana', 'Mesa'
        waiter.save()
        self._order(self.burger, '20000.00', created_by=waiter)
        self._order(self.coffee, '3000.00', created_by=waiter)
        self._order(self.juice, '4000.00')

        report = sales.staff_report(WEEK)

        self.assertEqual(report['total'], '27000.00')
        self.assertEqual(
            report['staff'],
            [
                {
                    'user_id': waiter.id,
                    'name': 'Ana Mesa',
                    'amount': '23000.00',
                    'share': '85.2',
                    'lines': 2,
                    'bills': 1,
                },
                {
                    'user_id': None,
                    'name': 'Cliente (carta QR)',
                    'amount': '4000.00',
                    'share': '14.8',
                    'lines': 1,
                    'bills': 1,
                },
            ],
        )

    def test_tips_go_to_whoever_charged_with_reversals_subtracting(self) -> None:
        cashier = create_member('cashier')
        payment = Payment.objects.create(
            bill=self.bill,
            method=PaymentMethod.CASH,
            amount=Decimal('10000'),
            tip=Decimal('1000'),
            created_by=cashier,
        )
        Payment.objects.create(
            bill=self.bill,
            method=PaymentMethod.CARD,
            amount=Decimal('5000'),
            tip=Decimal('500'),
            created_by=cashier,
        )
        Payment.objects.create(
            bill=self.bill,
            method=PaymentMethod.CASH,
            amount=-payment.amount,
            tip=-payment.tip,
            reverses=payment,
            created_by=cashier,
        )
        Payment.objects.filter(bill=self.bill).update(created_at=at(TODAY, 21))

        tips = sales.staff_report(WEEK)['tips']

        self.assertEqual(
            tips, [{'user_id': cashier.id, 'name': 'cashier@example.com', 'tips': '500.00', 'payments': 2}]
        )


class CancellationsReportTests(SalesReportTestCase):
    def test_groups_reasons_ignoring_case_and_spaces(self) -> None:
        self._order(self.coffee, '3000.00', status_=OrderStatus.CANCELLED, cancel_reason='Se demoró')
        self._order(
            self.coffee, '3000.00', quantity=2, status_=OrderStatus.CANCELLED, cancel_reason=' se demoró '
        )
        self._order(self.burger, '20000.00', status_=OrderStatus.CANCELLED)
        self._order(self.juice, '4000.00')

        report = sales.cancellations_report(WEEK)

        self.assertEqual((report['count'], report['units'], report['amount']), (3, 4, '29000.00'))
        self.assertEqual(
            report['by_reason'],
            [
                {'reason': 'Se demoró', 'count': 2, 'units': 3, 'amount': '9000.00'},
                {'reason': 'Sin motivo', 'count': 1, 'units': 1, 'amount': '20000.00'},
            ],
        )
        self.assertEqual(report['by_product'][0]['name'], 'Café')
        self.assertEqual(report['by_product'][0]['count'], 2)

    def test_lists_the_latest_cancellations_first(self) -> None:
        self._order(self.coffee, '3000.00', status_=OrderStatus.CANCELLED, when=at(TODAY, 19))
        latest = self._order(
            self.burger,
            '20000.00',
            quantity=2,
            status_=OrderStatus.CANCELLED,
            cancel_reason='Sin pan',
            when=at(TODAY, 21),
        )

        rows = sales.cancellations_report(WEEK)['latest']

        self.assertEqual(
            rows[0],
            {
                'id': latest.id,
                'created_at': latest.created_at,
                'table_number': 4,
                'product': 'Hamburguesa',
                'quantity': 2,
                'amount': '40000.00',
                'reason': 'Sin pan',
                'placed_by': 'Cliente (carta QR)',
                'cancelled_at': None,
                'cancelled_by': None,
            },
        )
        self.assertEqual(len(sales.cancellations_report(WEEK, latest_limit=1)['latest']), 1)


class SalesReportApiTests(SalesReportTestCase):
    def setUp(self) -> None:
        super().setUp()
        seed_roles()
        self.admin = create_admin()

    def _get(self, path: str, user=None, **params):
        self.client.force_authenticate(user or self.admin)
        return self.client.get(f'/api/reports/{path}/', params)

    def test_admin_gets_each_report_with_its_range(self) -> None:
        self._order(self.coffee, '3000.00', when=timezone.now())

        for path in ('products', 'categories', 'hours', 'staff', 'cancellations', 'kitchen'):
            with self.subTest(path=path):
                response = self._get(path)

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(set(response.data['range']), {'first', 'last', 'today'})
                self.assertEqual(response.data['range']['last'], response.data['range']['today'])

    def test_uses_the_requested_range(self) -> None:
        self._order(self.coffee, '3000.00', when=at(datetime.date(2026, 10, 1), 20))

        response = self._get('products', **{'from': '2026-10-01', 'to': '2026-10-01'})

        self.assertEqual(response.data['total'], '3000.00')
        self.assertEqual(response.data['range']['first'], datetime.date(2026, 10, 1))

    def test_rejects_invalid_dates_and_ranges(self) -> None:
        for params in (
            {'from': '11/10/2026'},
            {'from': '2026-11-10', 'to': '2026-11-01'},
            {'from': '2020-01-01', 'to': '2026-01-01'},
        ):
            with self.subTest(params=params):
                self.assertEqual(self._get('products', **params).status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_the_admin_sees_the_reports(self) -> None:
        for role in (WAITER_ROLE, CASHIER_ROLE):
            with self.subTest(role=role):
                self.assertEqual(
                    self._get('staff', create_role_member(role)).status_code, status.HTTP_403_FORBIDDEN
                )
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/reports/staff/').status_code, status.HTTP_401_UNAUTHORIZED)

    def test_downloads_the_report_as_csv(self) -> None:
        self._order(self.coffee, '3000.50', when=at(datetime.date(2026, 10, 1), 20))

        response = self._get('products', **{'from': '2026-10-01', 'to': '2026-10-07', 'export': 'csv'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv; charset=utf-8')
        self.assertEqual(
            response['Content-Disposition'],
            'attachment; filename="reporte-productos-2026-10-01-a-2026-10-07.csv"',
        )
        lines = response.content.decode('utf-8').splitlines()
        self.assertEqual(lines[0], '﻿Producto;Categoría;Unidades;Consumo;% del total')
        self.assertEqual(lines[1], 'Café;Bebidas;1;3000,50;100,0')

    def test_the_csv_lists_every_cancellation_in_local_time(self) -> None:
        for _ in range(sales.LATEST_CANCELLATIONS + 1):
            self._order(self.coffee, '3000.00', status_=OrderStatus.CANCELLED, when=at(TODAY, 20, 15))

        response = self._get('cancellations', **{'from': '2026-11-11', 'to': '2026-11-11', 'export': 'csv'})

        lines = response.content.decode('utf-8').splitlines()
        self.assertEqual(len(lines), sales.LATEST_CANCELLATIONS + 2)
        self.assertTrue(lines[1].startswith('2026-11-11 20:15;4;Café;1;3000,00;Sin motivo;'))

    def test_downloads_the_report_as_excel(self) -> None:
        self._order(self.coffee, '3000.50', when=at(datetime.date(2026, 10, 1), 20))

        response = self._get('products', **{'from': '2026-10-01', 'to': '2026-10-07', 'export': 'xlsx'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response['Content-Type'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        self.assertEqual(
            response['Content-Disposition'],
            'attachment; filename="reporte-productos-2026-10-01-a-2026-10-07.xlsx"',
        )
        sheet = load_workbook(io.BytesIO(response.content)).active
        self.assertEqual([cell.value for cell in sheet[2]], ['Café', 'Bebidas', 1, 3000.5, 100])

    def test_cancellations_say_who_cancelled_and_when(self) -> None:
        order = self._order(self.coffee, '3000.00', status_=OrderStatus.CANCELLED)
        OrderStatusChange.objects.create(
            order=order,
            from_status=OrderStatus.PENDING,
            to_status=OrderStatus.CANCELLED,
            changed_at=at(TODAY, 20, 30),
            changed_by=self.admin,
        )

        [row] = self._get('cancellations').data['latest']

        self.assertEqual(row['cancelled_at'], at(TODAY, 20, 30))
        self.assertEqual(row['cancelled_by'], 'admin@example.com')

    def test_the_number_of_queries_does_not_grow_with_the_data(self) -> None:
        def count_queries(path: str) -> int:
            with CaptureQueriesContext(connection) as queries:
                self._get(path)
            return len(queries)

        business_day_start_hour()
        self._order(self.coffee, '3000.00', when=timezone.now(), status_=OrderStatus.CANCELLED)
        before = {
            path: count_queries(path)
            for path in ('products', 'categories', 'hours', 'staff', 'cancellations', 'kitchen')
        }
        for product in (self.juice, self.burger, self._product('Pan', None)):
            self._order(product, '1000.00', when=timezone.now(), created_by=create_member(product.title))
            self._order(product, '1000.00', when=timezone.now(), status_=OrderStatus.CANCELLED)

        for path, queries in before.items():
            with self.subTest(path=path):
                self.assertEqual(count_queries(path), queries)
