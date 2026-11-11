from datetime import timedelta
from importlib import import_module

from django.apps import apps
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status

from categories.models import Category
from configuration.models import SETTINGS_ID, PaymentMode, RestaurantSettings
from icard.testing import MediaTestCase, create_admin, create_role_member, make_image, seed_roles
from orders.models import Order, OrderStatus
from orders.services import OrderItem, create_orders
from payments.models import Bill, BillStatus, Payment, PaymentMethod
from products.models import MAX_PREPARATION_MINUTES, Product
from tables.models import Table
from users.roles import CASHIER_ROLE, KITCHEN_ROLE, WAITER_ROLE

PRODUCTS_URL = '/api/products/'
ORDERS_URL = '/api/orders/'
BURGER_MINUTES = 20
BACKFILL_MIGRATION = import_module('orders.migrations.0007_backfill_kitchen_at')


class PreparationTestCase(MediaTestCase):
    def setUp(self) -> None:
        cache.clear()
        seed_roles()
        category = Category.objects.create(title='Platos', image=make_image())
        self.burger = Product.objects.create(
            title='Hamburguesa',
            image=make_image(),
            price='20.00',
            active=True,
            category=category,
            preparation_time=BURGER_MINUTES,
        )
        self.soda = Product.objects.create(
            title='Gaseosa', image=make_image(), price='5.00', active=True, category=category
        )
        self.table = Table.objects.create(number=3, is_open=True)
        self.admin = create_admin()
        self.waiter = create_role_member(WAITER_ROLE)
        self.cook = create_role_member(KITCHEN_ROLE)
        self.cashier = create_role_member(CASHIER_ROLE)

    def _order(self, product: Product) -> Order:
        [order] = create_orders(self.table, [OrderItem(product, 1, '')], self.waiter)
        return Order.objects.get(pk=order.pk)

    def _patch_product(self, user, payload: dict, fmt: str = 'json'):
        self.client.force_authenticate(user)
        return self.client.patch(f'{PRODUCTS_URL}{self.burger.id}/', payload, format=fmt)


class ProductPreparationTimeTests(PreparationTestCase):
    def test_the_menu_shows_the_preparation_time(self) -> None:
        data = self.client.get(f'{PRODUCTS_URL}{self.burger.id}/').data

        self.assertEqual(data['preparation_time'], BURGER_MINUTES)

    def test_admin_sets_the_time(self) -> None:
        response = self._patch_product(self.admin, {'preparation_time': 35})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.burger.refresh_from_db()
        self.assertEqual(self.burger.preparation_time, 35)

    def test_out_of_range_times_are_rejected(self) -> None:
        for minutes in (0, -5, MAX_PREPARATION_MINUTES + 1):
            with self.subTest(minutes=minutes):
                response = self._patch_product(self.admin, {'preparation_time': minutes})
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.burger.refresh_from_db()
        self.assertEqual(self.burger.preparation_time, BURGER_MINUTES)

    def test_an_empty_value_from_the_form_clears_the_time(self) -> None:
        response = self._patch_product(self.admin, {'preparation_time': ''}, fmt='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.burger.refresh_from_db()
        self.assertIsNone(self.burger.preparation_time)

    def test_staff_without_admin_rights_cannot_change_it(self) -> None:
        for user in (self.waiter, self.cook):
            with self.subTest(user=user.email):
                response = self._patch_product(user, {'preparation_time': 5})
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class OrderPreparationTests(PreparationTestCase):
    def test_the_order_copies_the_time_of_the_product(self) -> None:
        order = self._order(self.burger)
        Product.objects.filter(pk=self.burger.pk).update(preparation_time=45)

        order.refresh_from_db()
        self.assertEqual(order.preparation_minutes, BURGER_MINUTES)

    def test_a_product_without_time_leaves_the_order_without_time(self) -> None:
        self.assertIsNone(self._order(self.soda).preparation_minutes)

    def test_a_normal_order_enters_the_kitchen_when_it_is_created(self) -> None:
        before = timezone.now()
        order = self._order(self.burger)

        self.assertEqual(order.status, OrderStatus.PENDING)
        self.assertGreaterEqual(order.kitchen_at, before)

    def test_the_api_returns_time_and_kitchen_entry_read_only(self) -> None:
        order = self._order(self.burger)
        self.client.force_authenticate(self.cook)

        data = self.client.get(f'{ORDERS_URL}{order.id}/').data

        self.assertEqual(data['preparation_minutes'], BURGER_MINUTES)
        self.assertIsNotNone(data['kitchen_at'])


class PrepaidKitchenEntryTests(PreparationTestCase):
    def setUp(self) -> None:
        super().setUp()
        RestaurantSettings.objects.update_or_create(
            pk=SETTINGS_ID, defaults={'payment_mode': PaymentMode.PREPAID}
        )
        self.order = self._order(self.burger)

    def _charge(self):
        bill = Bill.objects.get(table=self.table, status=BillStatus.OPEN)
        self.client.force_authenticate(self.cashier)
        payload = {'method': PaymentMethod.CASH, 'amount': '20.00', 'orders': [self.order.id]}
        return self.client.post(f'/api/bills/{bill.id}/payments/', payload, format='json')

    def test_an_unpaid_order_has_not_entered_the_kitchen(self) -> None:
        self.assertEqual(self.order.status, OrderStatus.AWAITING_PAYMENT)
        self.assertIsNone(self.order.kitchen_at)

    def test_paying_the_order_starts_the_kitchen_clock(self) -> None:
        Order.objects.filter(pk=self.order.pk).update(created_at=timezone.now() - timedelta(minutes=30))
        before = timezone.now()

        self.assertEqual(self._charge().status_code, status.HTTP_201_CREATED)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.PENDING)
        self.assertGreaterEqual(self.order.kitchen_at, before)

    def test_reversing_the_payment_clears_the_kitchen_entry(self) -> None:
        self._charge()
        self.client.force_authenticate(self.admin)
        response = self.client.post(f'/api/payments/{Payment.objects.get().id}/reverse/', {'reason': 'Error'})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.order.refresh_from_db()
        self.assertIsNone(self.order.kitchen_at)


class BackfillMigrationTests(PreparationTestCase):
    def test_existing_orders_use_their_creation_time_except_those_awaiting_payment(self) -> None:
        cooking = self._order(self.burger)
        awaiting = self._order(self.soda)
        Order.objects.filter(pk=awaiting.pk).update(status=OrderStatus.AWAITING_PAYMENT)
        Order.objects.update(kitchen_at=None)

        BACKFILL_MIGRATION.backfill_kitchen_at(apps, None)

        cooking.refresh_from_db()
        awaiting.refresh_from_db()
        self.assertEqual(cooking.kitchen_at, cooking.created_at)
        self.assertIsNone(awaiting.kitchen_at)
