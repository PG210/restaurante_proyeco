import uuid
from decimal import Decimal
from unittest import mock

from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.throttling import SimpleRateThrottle

from categories.models import Category
from icard.testing import MediaTestCase, create_admin, make_image
from orders.models import Order, OrderStatus
from products.models import Product
from tables.models import Table

PRODUCT_PRICE = Decimal('4.50')
TABLE_NOT_FOUND_MESSAGE = 'Este código QR no es válido.'
FIRST_IP = '10.0.0.1'
SECOND_IP = '10.0.0.2'


def client_url(token, resource: str = '') -> str:
    suffix = f'{resource}/' if resource else ''
    return f'/api/client/{token}/{suffix}'


def throttle_rates(**rates: str):
    return mock.patch.dict(SimpleRateThrottle.THROTTLE_RATES, rates)


class ClientApiTestCase(MediaTestCase):
    def setUp(self) -> None:
        cache.clear()
        category = Category.objects.create(title='Postres', image=make_image())
        self.product = Product.objects.create(
            title='Helado', image=make_image(), price=PRODUCT_PRICE, active=True, category=category
        )
        self.inactive_product = Product.objects.create(title='Flan', image=make_image(), price='3.00')
        self.table = Table.objects.create(number=5, is_open=True)
        self.other_table = Table.objects.create(number=6, is_open=True)
        self.closed_table = Table.objects.create(number=7)

    def _items(self, count: int = 1, **overrides) -> dict:
        item = {'product': self.product.id, 'quantity': 1, 'notes': '', **overrides}
        return {'items': [item] * count}

    def _order(self, table: Table | None = None, ip: str = FIRST_IP, **overrides):
        return self.client.post(
            client_url((table or self.table).token, 'orders'),
            self._items(**overrides),
            format='json',
            REMOTE_ADDR=ip,
        )


class ClientTableAccessTests(ClientApiTestCase):
    def test_returns_table_state_without_login(self) -> None:
        response = self.client.get(client_url(self.table.token))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'number': 5, 'is_open': True, 'bill_requested': False})

    def test_unknown_token_returns_404(self) -> None:
        response = self.client.get(client_url(uuid.uuid4()))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['detail'], TABLE_NOT_FOUND_MESSAGE)

    def test_malformed_token_returns_the_same_404(self) -> None:
        response = self.client.get(client_url('no-es-un-token'))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['detail'], TABLE_NOT_FOUND_MESSAGE)

    def test_table_number_is_not_accepted_as_token(self) -> None:
        response = self.client.get(client_url(self.table.number))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_regenerated_token_invalidates_the_previous_one(self) -> None:
        previous_token = self.table.token
        self.client.force_authenticate(create_admin())
        self.client.post(f'/api/tables/{self.table.id}/regenerate-token/')
        self.client.force_authenticate(None)
        response = self.client.get(client_url(previous_token))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ClientOrderTests(ClientApiTestCase):
    def test_creates_pending_orders_with_copied_price(self) -> None:
        response = self._order(notes='sin azúcar', quantity=2)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order = Order.objects.get()
        self.assertEqual(order.status, OrderStatus.PENDING)
        self.assertEqual(order.price, PRODUCT_PRICE)
        self.assertEqual(order.quantity, 2)
        self.assertIsNone(order.created_by)
        self.assertEqual(order.table, self.table)

    def test_response_does_not_expose_staff_data(self) -> None:
        response = self._order()
        self.assertNotIn('created_by', response.data[0])
        self.assertNotIn('created_by_email', response.data[0])
        self.assertEqual(response.data[0]['product_title'], 'Helado')

    def test_closed_table_cannot_order(self) -> None:
        response = self._order(table=self.closed_table)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Order.objects.exists())

    def test_unknown_token_cannot_order(self) -> None:
        response = self.client.post(client_url(uuid.uuid4(), 'orders'), self._items(), format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_inactive_product_is_rejected(self) -> None:
        response = self._order(product=self.inactive_product.id)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.exists())

    def test_zero_quantity_is_rejected(self) -> None:
        response = self._order(quantity=0)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_quantity_above_the_limit_is_rejected(self) -> None:
        response = self._order(quantity=21)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_too_many_items_are_rejected(self) -> None:
        response = self.client.post(
            client_url(self.table.token, 'orders'), self._items(count=21), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.exists())

    def test_empty_order_is_rejected(self) -> None:
        response = self.client.post(client_url(self.table.token, 'orders'), {'items': []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_one_invalid_item_creates_nothing(self) -> None:
        payload = {'items': [{'product': self.product.id}, {'product': self.inactive_product.id}]}
        response = self.client.post(client_url(self.table.token, 'orders'), payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.exists())

    @override_settings(CLIENT_MAX_PENDING_ORDERS_PER_TABLE=2)
    def test_pending_orders_cap_per_table(self) -> None:
        self.client.post(client_url(self.table.token, 'orders'), self._items(count=2), format='json')
        response = self._order()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('items', response.data)
        self.assertEqual(Order.objects.count(), 2)

    def test_lists_only_the_orders_of_its_table(self) -> None:
        self._order()
        self._order(table=self.other_table)
        response = self.client.get(client_url(self.table.token, 'orders'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(Order.objects.get(pk=response.data[0]['id']).table, self.table)

    def test_closed_orders_are_not_listed(self) -> None:
        self._order()
        Order.objects.update(close=True)
        response = self.client.get(client_url(self.table.token, 'orders'))
        self.assertEqual(response.data, [])


class ClientBillTests(ClientApiTestCase):
    def test_requests_the_bill(self) -> None:
        response = self.client.post(client_url(self.table.token, 'bill'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['bill_requested'])

    def test_requesting_twice_keeps_the_first_time(self) -> None:
        self.client.post(client_url(self.table.token, 'bill'))
        first_requested_at = Table.objects.get(pk=self.table.pk).bill_requested_at
        self.client.post(client_url(self.table.token, 'bill'))
        self.assertEqual(Table.objects.get(pk=self.table.pk).bill_requested_at, first_requested_at)

    def test_closed_table_cannot_request_the_bill(self) -> None:
        response = self.client.post(client_url(self.closed_table.token, 'bill'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ClientThrottlingTests(ClientApiTestCase):
    def test_orders_are_throttled_per_table(self) -> None:
        with throttle_rates(client_order='2/min'):
            self._order()
            self._order()
            response = self._order()
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('Retry-After', response.headers)
        self.assertEqual(Order.objects.count(), 2)

    def test_a_throttled_table_does_not_block_another_table_on_the_same_wifi(self) -> None:
        with throttle_rates(client_order='1/min'):
            self._order()
            throttled = self._order()
            other_table = self._order(table=self.other_table)
        self.assertEqual(throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(other_table.status_code, status.HTTP_201_CREATED)

    def test_requests_are_throttled_per_ip_across_tables(self) -> None:
        with throttle_rates(client_ip='2/min'):
            self.client.get(client_url(self.table.token), REMOTE_ADDR=FIRST_IP)
            self.client.get(client_url(self.other_table.token), REMOTE_ADDR=FIRST_IP)
            blocked = self.client.get(client_url(self.closed_table.token), REMOTE_ADDR=FIRST_IP)
            other_ip = self.client.get(client_url(self.table.token), REMOTE_ADDR=SECOND_IP)
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(other_ip.status_code, status.HTTP_200_OK)

    def test_reads_are_throttled_per_table(self) -> None:
        with throttle_rates(client_read='2/min'):
            self.client.get(client_url(self.table.token, 'orders'), REMOTE_ADDR=FIRST_IP)
            self.client.get(client_url(self.table.token, 'orders'), REMOTE_ADDR=SECOND_IP)
            response = self.client.get(client_url(self.table.token, 'orders'), REMOTE_ADDR=FIRST_IP)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_bill_requests_are_throttled(self) -> None:
        with throttle_rates(client_bill='1/min'):
            self.client.post(client_url(self.table.token, 'bill'))
            response = self.client.post(client_url(self.table.token, 'bill'))
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_unknown_tokens_are_throttled_by_ip(self) -> None:
        with throttle_rates(client_ip='2/min'):
            for _ in range(2):
                self.client.get(client_url(uuid.uuid4()))
            response = self.client.get(client_url(uuid.uuid4()))
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_public_catalog_is_throttled_for_anonymous_visitors(self) -> None:
        with throttle_rates(anon='2/min'):
            self.client.get('/api/products/')
            self.client.get('/api/categories/')
            response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_staff_is_not_limited_by_the_anonymous_rate(self) -> None:
        self.client.force_authenticate(create_admin())
        with throttle_rates(anon='1/min'):
            self.client.get('/api/products/')
            response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
