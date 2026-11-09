from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from rest_framework import status

from categories.models import Category
from icard.testing import (
    MediaTestCase,
    create_admin,
    create_member,
    create_role_member,
    make_image,
    seed_roles,
)
from orders.models import Order, OrderStatus
from products.models import Product
from tables.models import Table
from users.roles import CASHIER_ROLE, KITCHEN_ROLE, WAITER_ROLE

ORDERS_URL = '/api/orders/'
BULK_URL = f'{ORDERS_URL}bulk/'
BULK_ADVANCE_URL = f'{ORDERS_URL}bulk-advance/'
MISSING_ID = 999999
PRODUCT_PRICE = Decimal('4.50')


def order_url(order_id: int, action: str = '') -> str:
    suffix = f'{action}/' if action else ''
    return f'{ORDERS_URL}{order_id}/{suffix}'


class OrderApiTestCase(MediaTestCase):
    def setUp(self) -> None:
        seed_roles()
        self.table = Table.objects.create(number=1)
        category = Category.objects.create(title='Postres', image=make_image())
        self.product = Product.objects.create(
            title='Helado', image=make_image(), price=PRODUCT_PRICE, active=True, category=category
        )
        self.inactive_product = Product.objects.create(title='Flan', image=make_image(), price='3.00')
        self.admin = create_admin()
        self.waiter = create_role_member(WAITER_ROLE)
        self.cook = create_role_member(KITCHEN_ROLE)
        self.cashier = create_role_member(CASHIER_ROLE)

    def _order(self, order_status: str = OrderStatus.PENDING) -> Order:
        return Order.objects.create(
            table=self.table, product=self.product, status=order_status, price=PRODUCT_PRICE
        )

    def _payload(self, **overrides) -> dict:
        return {'table': self.table.id, 'product': self.product.id, 'quantity': 2, 'notes': '', **overrides}


class OrderReadTests(OrderApiTestCase):
    def test_anonymous_cannot_list_orders(self) -> None:
        response = self.client.get(ORDERS_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_without_role_cannot_list_orders(self) -> None:
        self.client.force_authenticate(create_member())
        response = self.client.get(ORDERS_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cashier_can_list_orders(self) -> None:
        self._order()
        self.client.force_authenticate(self.cashier)
        response = self.client.get(ORDERS_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_filter_by_open_statuses(self) -> None:
        self._order(OrderStatus.READY)
        self._order(OrderStatus.DELIVERED)
        self.client.force_authenticate(self.waiter)
        response = self.client.get(ORDERS_URL, {'status__in': 'PENDING,PREPARING,READY'})
        self.assertEqual([item['status'] for item in response.data], [OrderStatus.READY])

    def test_missing_order_returns_404(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.get(order_url(MISSING_ID))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class OrderCreateTests(OrderApiTestCase):
    def test_waiter_creates_pending_order_with_copied_price(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.post(ORDERS_URL, self._payload(notes='sin azúcar'), format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], OrderStatus.PENDING)
        self.assertEqual(response.data['price'], '4.50')
        self.assertEqual(response.data['quantity'], 2)
        self.assertEqual(response.data['created_by'], self.waiter.id)

    def test_price_does_not_change_when_product_price_changes(self) -> None:
        self.client.force_authenticate(self.waiter)
        order_id = self.client.post(ORDERS_URL, self._payload(), format='json').data['id']
        Product.objects.filter(pk=self.product.pk).update(price='9.99')
        response = self.client.get(order_url(order_id))
        self.assertEqual(response.data['price'], '4.50')

    def test_status_sent_by_client_is_ignored(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.post(ORDERS_URL, self._payload(status=OrderStatus.DELIVERED), format='json')
        self.assertEqual(response.data['status'], OrderStatus.PENDING)

    def test_inactive_product_is_rejected(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.post(
            ORDERS_URL, self._payload(product=self.inactive_product.id), format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('product', response.data)

    def test_zero_quantity_is_rejected(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.post(ORDERS_URL, self._payload(quantity=0), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('quantity', response.data)

    def test_missing_table_is_rejected(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.post(ORDERS_URL, self._payload(table=MISSING_ID), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('table', response.data)

    def test_anonymous_cannot_create_order(self) -> None:
        response = self.client.post(ORDERS_URL, self._payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cook_cannot_create_order(self) -> None:
        self.client.force_authenticate(self.cook)
        response = self.client.post(ORDERS_URL, self._payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Order.objects.exists())

    def test_bulk_creates_every_item(self) -> None:
        self.client.force_authenticate(self.waiter)
        payload = {
            'table': self.table.id,
            'items': [
                {'product': self.product.id, 'quantity': 1},
                {'product': self.product.id, 'notes': 'frío'},
            ],
        }
        response = self.client.post(BULK_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(Order.objects.count(), 2)

    def test_bulk_with_one_invalid_item_creates_nothing(self) -> None:
        self.client.force_authenticate(self.waiter)
        payload = {
            'table': self.table.id,
            'items': [{'product': self.product.id}, {'product': self.inactive_product.id}],
        }
        response = self.client.post(BULK_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.exists())

    def test_bulk_without_items_is_rejected(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.post(BULK_URL, {'table': self.table.id, 'items': []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class OrderTransitionTests(OrderApiTestCase):
    def _advance(self, user, order: Order):
        self.client.force_authenticate(user)
        return self.client.post(order_url(order.id, 'advance'))

    def test_cook_moves_order_to_preparing_and_ready(self) -> None:
        order = self._order()
        self.assertEqual(self._advance(self.cook, order).data['status'], OrderStatus.PREPARING)
        self.assertEqual(self._advance(self.cook, order).data['status'], OrderStatus.READY)

    def test_waiter_delivers_ready_order(self) -> None:
        order = self._order(OrderStatus.READY)
        response = self._advance(self.waiter, order)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], OrderStatus.DELIVERED)

    def test_waiter_cannot_prepare_order(self) -> None:
        order = self._order()
        response = self._advance(self.waiter, order)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PENDING)

    def test_cook_cannot_deliver_order(self) -> None:
        order = self._order(OrderStatus.READY)
        response = self._advance(self.cook, order)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delivered_order_cannot_advance(self) -> None:
        order = self._order(OrderStatus.DELIVERED)
        response = self._advance(self.admin, order)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', response.data)

    def test_advance_missing_order_returns_404(self) -> None:
        self.client.force_authenticate(self.cook)
        response = self.client.post(order_url(MISSING_ID, 'advance'))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_waiter_cancels_order_with_reason(self) -> None:
        order = self._order(OrderStatus.PREPARING)
        self.client.force_authenticate(self.waiter)
        response = self.client.post(order_url(order.id, 'cancel'), {'reason': 'El cliente se fue'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], OrderStatus.CANCELLED)
        self.assertEqual(response.data['cancel_reason'], 'El cliente se fue')

    def test_cancel_without_reason_is_rejected(self) -> None:
        order = self._order()
        self.client.force_authenticate(self.waiter)
        response = self.client.post(order_url(order.id, 'cancel'), {'reason': ''})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reason', response.data)

    def test_delivered_order_cannot_be_cancelled(self) -> None:
        order = self._order(OrderStatus.DELIVERED)
        self.client.force_authenticate(self.waiter)
        response = self.client.post(order_url(order.id, 'cancel'), {'reason': 'Error'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cook_cannot_cancel_order(self) -> None:
        order = self._order()
        self.client.force_authenticate(self.cook)
        response = self.client.post(order_url(order.id, 'cancel'), {'reason': 'Sin stock'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class OrderBulkAdvanceTests(OrderApiTestCase):
    def _bulk_advance(self, user, order_ids: list[int]):
        self.client.force_authenticate(user)
        return self.client.post(BULK_ADVANCE_URL, {'ids': order_ids}, format='json')

    def _statuses(self, *orders: Order) -> list[str]:
        return [Order.objects.get(pk=order.pk).status for order in orders]

    def test_cook_sends_every_pending_order_to_preparation(self) -> None:
        first, second = self._order(), self._order()
        response = self._bulk_advance(self.cook, [first.id, second.id])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['status'] for item in response.data], [OrderStatus.PREPARING] * 2)
        self.assertEqual(self._statuses(first, second), [OrderStatus.PREPARING] * 2)

    def test_each_order_moves_to_its_own_next_status(self) -> None:
        pending, preparing = self._order(), self._order(OrderStatus.PREPARING)
        response = self._bulk_advance(self.cook, [pending.id, preparing.id])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._statuses(pending, preparing), [OrderStatus.PREPARING, OrderStatus.READY])

    def test_waiter_cannot_send_orders_to_preparation(self) -> None:
        first, second = self._order(), self._order()
        response = self._bulk_advance(self.waiter, [first.id, second.id])
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self._statuses(first, second), [OrderStatus.PENDING] * 2)

    def test_one_order_without_permission_blocks_the_whole_batch(self) -> None:
        pending, ready = self._order(), self._order(OrderStatus.READY)
        response = self._bulk_advance(self.cook, [pending.id, ready.id])
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self._statuses(pending, ready), [OrderStatus.PENDING, OrderStatus.READY])

    def test_one_closed_order_blocks_the_whole_batch(self) -> None:
        pending, delivered = self._order(), self._order(OrderStatus.DELIVERED)
        response = self._bulk_advance(self.admin, [pending.id, delivered.id])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('status', response.data)
        self.assertEqual(self._statuses(pending), [OrderStatus.PENDING])

    def test_missing_order_is_rejected_without_changes(self) -> None:
        pending = self._order()
        response = self._bulk_advance(self.cook, [pending.id, MISSING_ID])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ids', response.data)
        self.assertEqual(self._statuses(pending), [OrderStatus.PENDING])

    def test_duplicated_ids_advance_the_order_once(self) -> None:
        pending = self._order()
        response = self._bulk_advance(self.cook, [pending.id, pending.id])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._statuses(pending), [OrderStatus.PREPARING])

    def test_empty_list_is_rejected(self) -> None:
        response = self._bulk_advance(self.cook, [])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ids', response.data)

    def test_anonymous_cannot_bulk_advance(self) -> None:
        response = self.client.post(BULK_ADVANCE_URL, {'ids': [self._order().id]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class OrderEditTests(OrderApiTestCase):
    def test_staff_edits_pending_order(self) -> None:
        order = self._order()
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            order_url(order.id), {'quantity': 3, 'notes': 'sin hielo'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['quantity'], 3)
        self.assertEqual(response.data['notes'], 'sin hielo')

    def test_status_cannot_be_changed_with_patch(self) -> None:
        order = self._order()
        self.client.force_authenticate(self.admin)
        self.client.patch(order_url(order.id), {'status': OrderStatus.DELIVERED}, format='json')
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PENDING)

    def test_order_in_preparation_cannot_be_edited(self) -> None:
        order = self._order(OrderStatus.PREPARING)
        self.client.force_authenticate(self.admin)
        response = self.client.patch(order_url(order.id), {'quantity': 3}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_waiter_cannot_edit_order(self) -> None:
        order = self._order()
        self.client.force_authenticate(self.waiter)
        response = self.client.patch(order_url(order.id), {'quantity': 3}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_waiter_cannot_delete_order(self) -> None:
        order = self._order()
        self.client.force_authenticate(self.waiter)
        response = self.client.delete(order_url(order.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Order.objects.filter(pk=order.pk).exists())


class BackfillOrderPricesCommandTests(TestCase):
    def setUp(self) -> None:
        self.table = Table.objects.create(number=1)
        self.product = Product.objects.create(title='Agua', image='products/agua.png', price='2.00')
        self.order_without_price = Order.objects.create(table=self.table, product=self.product)
        self.order_without_product = Order.objects.create(table=self.table)

    def _run(self, *args: str) -> str:
        output = StringIO()
        call_command('backfill_order_prices', *args, stdout=output)
        return output.getvalue()

    def test_assigns_current_product_price(self) -> None:
        output = self._run()
        self.order_without_price.refresh_from_db()
        self.assertEqual(self.order_without_price.price, Decimal('2.00'))
        self.assertIn('Pedidos actualizados: 1', output)
        self.assertIn('se omiten): 1', output)

    def test_dry_run_does_not_write(self) -> None:
        output = self._run('--dry-run')
        self.order_without_price.refresh_from_db()
        self.assertIsNone(self.order_without_price.price)
        self.assertIn('Se actualizarían 1', output)

    def test_is_idempotent(self) -> None:
        self._run()
        output = self._run()
        self.assertIn('Pedidos actualizados: 0', output)
