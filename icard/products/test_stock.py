import datetime
import shutil
import tempfile
import threading
from unittest import mock
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.db import close_old_connections
from django.test import TransactionTestCase, override_settings
from rest_framework import status

from categories.models import Category
from icard.testing import MediaTestCase, create_admin, create_role_member, make_image, seed_roles
from orders.models import Order, OrderStatus
from orders.services import OrderItem, create_orders
from products.models import ImmutableStockMovementError, Product, StockMovement, StockReason
from products.stock import InsufficientStockError
from tables.models import Table
from users.roles import KITCHEN_ROLE, WAITER_ROLE

BOGOTA = ZoneInfo('America/Bogota')
PRODUCTS_URL = '/api/products/'
ORDERS_URL = '/api/orders/'
BULK_URL = f'{ORDERS_URL}bulk/'
MISSING_ID = 999999


def product_url(product_id: int, suffix: str = '') -> str:
    return f'{PRODUCTS_URL}{product_id}/{suffix}'


def order_url(order_id: int, suffix: str = '') -> str:
    return f'{ORDERS_URL}{order_id}/{suffix}'


def frozen_now(day: int, hour: int):
    moment = datetime.datetime(2026, 11, day, hour, tzinfo=BOGOTA)
    return mock.patch('products.service_day.timezone.now', return_value=moment)


class StockTestCase(MediaTestCase):
    def setUp(self) -> None:
        cache.clear()
        seed_roles()
        category = Category.objects.create(title='Postres', image=make_image())
        self.flan = Product.objects.create(
            title='Flan', image=make_image(), price='3.00', active=True, category=category, stock=5
        )
        self.lunch = Product.objects.create(title='Almuerzo', image=make_image(), price='15.00', active=True)
        self.table = Table.objects.create(number=5, is_open=True)
        self.admin = create_admin()
        self.kitchen = create_role_member(KITCHEN_ROLE)
        self.waiter = create_role_member(WAITER_ROLE)

    def _order(self, product: Product | None = None, quantity: int = 1):
        self.client.force_authenticate(self.admin)
        payload = {'table': self.table.id, 'product': (product or self.flan).id, 'quantity': quantity}
        return self.client.post(ORDERS_URL, payload, format='json')

    def _stock(self, product: Product | None = None) -> int | None:
        return Product.objects.get(pk=(product or self.flan).pk).stock


class OrderStockTests(StockTestCase):
    def test_order_takes_units_and_records_the_movement(self) -> None:
        response = self._order(quantity=2)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._stock(), 3)
        movement = StockMovement.objects.get()
        self.assertEqual((movement.change, movement.stock_after, movement.reason), (-2, 3, StockReason.ORDER))
        self.assertEqual(movement.order_id, response.data['id'])

    def test_guest_order_takes_units_too(self) -> None:
        payload = {'items': [{'product': self.flan.id, 'quantity': 2, 'notes': ''}]}
        response = self.client.post(f'/api/client/{self.table.token}/orders/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._stock(), 3)
        self.assertIsNone(StockMovement.objects.get().created_by)

    def test_not_enough_units_rejects_the_whole_submission(self) -> None:
        self.client.force_authenticate(self.admin)
        payload = {
            'table': self.table.id,
            'items': [
                {'product': self.lunch.id, 'quantity': 1},
                {'product': self.flan.id, 'quantity': 3},
                {'product': self.flan.id, 'quantity': 3},
            ],
        }
        response = self.client.post(BULK_URL, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Solo quedan 5 de Flan.')
        self.assertFalse(Order.objects.exists())
        self.assertEqual(self._stock(), 5)
        self.assertFalse(StockMovement.objects.exists())

    def test_product_runs_out_at_zero_and_comes_back_when_restocked(self) -> None:
        self._order(quantity=5)
        self.client.force_authenticate(None)
        self.assertFalse(self.client.get(product_url(self.flan.id)).data['is_available'])

        self.assertEqual(self._order().status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.kitchen)
        response = self.client.post(product_url(self.flan.id, 'stock/add/'), {'units': 4}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_available'])
        self.assertEqual(response.data['stock'], 4)

    def test_cancelling_returns_the_units(self) -> None:
        order_id = self._order(quantity=3).data['id']

        response = self.client.post(order_url(order_id, 'cancel/'), {'reason': 'Error'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._stock(), 5)
        self.assertEqual(StockMovement.objects.filter(reason=StockReason.CANCEL).get().change, 3)

    def test_editing_the_quantity_takes_or_returns_the_difference(self) -> None:
        order_id = self._order(quantity=2).data['id']

        self.client.patch(order_url(order_id), {'quantity': 4}, format='json')
        self.assertEqual(self._stock(), 1)
        self.client.patch(order_url(order_id), {'quantity': 1}, format='json')
        self.assertEqual(self._stock(), 4)

        response = self.client.patch(order_url(order_id), {'quantity': 9}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.get(pk=order_id).quantity, 1)
        self.assertEqual(self._stock(), 4)

    def test_deleting_an_open_order_returns_the_units(self) -> None:
        order_id = self._order(quantity=2).data['id']

        response = self.client.delete(order_url(order_id))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self._stock(), 5)

    def test_product_without_stock_control_behaves_as_before(self) -> None:
        response = self._order(product=self.lunch, quantity=30)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(self._stock(self.lunch))
        self.assertFalse(StockMovement.objects.exists())

    def test_cancelling_an_order_placed_before_tracking_adds_nothing(self) -> None:
        order_id = self._order(product=self.lunch, quantity=2).data['id']
        Product.objects.filter(pk=self.lunch.pk).update(stock=10)

        self.client.post(order_url(order_id, 'cancel/'), {'reason': 'Error'}, format='json')

        self.assertEqual(self._stock(self.lunch), 10)

    def test_cancelling_a_prepaid_order_awaiting_payment_returns_the_units(self) -> None:
        order_id = self._order(quantity=2).data['id']
        Order.objects.filter(pk=order_id).update(status=OrderStatus.AWAITING_PAYMENT)

        self.client.post(order_url(order_id, 'cancel/'), {'reason': 'No pagó'}, format='json')

        self.assertEqual(self._stock(), 5)


class StockManagementTests(StockTestCase):
    def test_kitchen_adjusts_after_a_count_with_a_reason(self) -> None:
        self.client.force_authenticate(self.kitchen)
        response = self.client.post(
            product_url(self.flan.id, 'stock/set/'), {'units': 2, 'note': 'Conteo de cierre'}, format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        movement = StockMovement.objects.get()
        self.assertEqual(
            (movement.change, movement.reason, movement.note), (-3, StockReason.ADJUST, 'Conteo de cierre')
        )

    def test_adjust_without_reason_or_with_invalid_units_is_rejected(self) -> None:
        self.client.force_authenticate(self.kitchen)
        url = product_url(self.flan.id, 'stock/set/')
        self.assertEqual(self.client.post(url, {'units': 2}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, {'units': -1, 'note': 'x'}, format='json').status_code, 400)
        add_url = product_url(self.flan.id, 'stock/add/')
        self.assertEqual(self.client.post(add_url, {'units': 0}, format='json').status_code, 400)

    def test_product_without_stock_control_cannot_be_restocked(self) -> None:
        self.client.force_authenticate(self.kitchen)
        response = self.client.post(product_url(self.lunch.id, 'stock/add/'), {'units': 3}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Almuerzo no tiene control de stock.')

    def test_permissions_and_missing_product(self) -> None:
        url = product_url(self.flan.id, 'stock/add/')
        self.assertEqual(self.client.post(url, {'units': 1}, format='json').status_code, 401)
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.post(url, {'units': 1}, format='json').status_code, 403)
        self.assertEqual(self.client.get(product_url(self.flan.id, 'stock-movements/')).status_code, 403)
        self.client.force_authenticate(self.kitchen)
        missing = product_url(MISSING_ID, 'stock/add/')
        self.assertEqual(self.client.post(missing, {'units': 1}, format='json').status_code, 404)

    def test_movement_history_is_paginated(self) -> None:
        self._order(quantity=1)
        self.client.force_authenticate(self.kitchen)
        self.client.post(product_url(self.flan.id, 'stock/add/'), {'units': 2}, format='json')

        response = self.client.get(product_url(self.flan.id, 'stock-movements/'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual([item['reason'] for item in response.data['results']], ['RESTOCK', 'ORDER'])

    def test_admin_edit_records_the_change_and_keeps_concurrent_stock(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.patch(product_url(self.flan.id), {'stock': 8}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(StockMovement.objects.get().change, 3)

        Product.objects.filter(pk=self.flan.pk).update(stock=6)
        self.client.patch(product_url(self.flan.id), {'title': 'Flan casero'}, format='multipart')
        self.assertEqual(self._stock(), 6)

    def test_admin_can_turn_stock_control_off(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.patch(product_url(self.flan.id), {'stock': ''}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(self._stock())

    def test_negative_stock_is_rejected(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.patch(product_url(self.flan.id), {'stock': -1}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_movements_cannot_be_changed_or_deleted(self) -> None:
        self._order()
        movement = StockMovement.objects.get()
        movement.change = 10
        with self.assertRaises(ImmutableStockMovementError):
            movement.save()
        with self.assertRaises(ImmutableStockMovementError):
            movement.delete()


class StockVisibilityTests(StockTestCase):
    def test_public_menu_does_not_show_units(self) -> None:
        data = self.client.get(product_url(self.flan.id)).data
        self.assertNotIn('stock', data)
        self.assertNotIn('sold_today', data)

    def test_sold_today_counts_orders_minus_cancellations_of_the_service_day(self) -> None:
        with frozen_now(9, 20):
            self._order(quantity=1)
        with frozen_now(10, 12):
            self._order(quantity=3)
            cancelled = self._order(quantity=1).data['id']
            self.client.post(order_url(cancelled, 'cancel/'), {'reason': 'Error'}, format='json')
            self.client.force_authenticate(self.kitchen)
            data = self.client.get(product_url(self.flan.id)).data

        self.assertEqual(data['stock'], 1)
        self.assertEqual(data['sold_today'], 3)
        self.assertIsNone(self.client.get(product_url(self.lunch.id)).data['sold_today'])

    def test_low_stock_flag_and_filter(self) -> None:
        Product.objects.filter(pk=self.flan.pk).update(low_stock_threshold=5)
        self.client.force_authenticate(self.kitchen)

        response = self.client.get(PRODUCTS_URL, {'low_stock': 'true'})

        self.assertEqual([item['id'] for item in response.data], [self.flan.id])
        self.assertTrue(response.data[0]['low_stock'])


class ConcurrentStockTests(TransactionTestCase):
    def setUp(self) -> None:
        media_root = tempfile.mkdtemp()
        media_override = override_settings(MEDIA_ROOT=media_root)
        media_override.enable()
        self.addCleanup(media_override.disable)
        self.addCleanup(shutil.rmtree, media_root, True)

    def test_only_one_of_two_simultaneous_orders_gets_the_last_unit(self) -> None:
        product = Product.objects.create(title='Flan', image=make_image(), price='3.00', active=True, stock=1)
        tables = [Table.objects.create(number=number, is_open=True) for number in (1, 2)]
        barrier = threading.Barrier(len(tables))
        outcomes = []

        def place(table: Table) -> None:
            try:
                barrier.wait()
                create_orders(table, [OrderItem(product=product, quantity=1, notes='')], user=None)
                outcomes.append('ok')
            except InsufficientStockError:
                outcomes.append('rejected')
            finally:
                close_old_connections()

        threads = [threading.Thread(target=place, args=(table,)) for table in tables]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(sorted(outcomes), ['ok', 'rejected'])
        self.assertEqual(Product.objects.get(pk=product.pk).stock, 0)
        self.assertEqual(Order.objects.count(), 1)
