from datetime import timedelta
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
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
from orders.services import OrderItem, create_orders
from payments.models import Bill, BillStatus, ImmutablePaymentError, Payment, PaymentMethod
from products.models import Product
from tables.models import Table
from users.roles import CASHIER_ROLE, KITCHEN_ROLE, WAITER_ROLE

BILLS_URL = '/api/bills/'
CURRENT_URL = f'{BILLS_URL}current/'
SUMMARY_URL = f'{BILLS_URL}summary/'
MISSING_ID = 999999
ICE_CREAM_PRICE = Decimal('4.50')
SOUP_PRICE = Decimal('12.00')


def charge_url(bill_id: int) -> str:
    return f'{BILLS_URL}{bill_id}/payments/'


def reverse_url(payment_id: int) -> str:
    return f'/api/payments/{payment_id}/reverse/'


class BillTestCase(MediaTestCase):
    def setUp(self) -> None:
        seed_roles()
        category = Category.objects.create(title='Carta', image=make_image())
        self.ice_cream = Product.objects.create(
            title='Helado', image=make_image(), price=ICE_CREAM_PRICE, active=True, category=category
        )
        self.soup = Product.objects.create(
            title='Sopa', image=make_image(), price=SOUP_PRICE, active=True, category=category
        )
        self.table = Table.objects.create(number=5, is_open=True, bill_requested_at=timezone.now())
        self.admin = create_admin()
        self.waiter = create_role_member(WAITER_ROLE)
        self.cashier = create_role_member(CASHIER_ROLE)
        self.cook = create_role_member(KITCHEN_ROLE)

    def _order(self, product: Product, quantity: int = 1, order_status: str = OrderStatus.DELIVERED) -> Order:
        [order] = create_orders(self.table, [OrderItem(product, quantity, '')], self.waiter)
        Order.objects.filter(pk=order.pk).update(status=order_status)
        return order

    def _bill(self) -> Bill:
        return Bill.objects.get(table=self.table, status=BillStatus.OPEN)

    def _charge(self, user, amount: str, method: str = PaymentMethod.CASH, **extra):
        self.client.force_authenticate(user)
        payload = {'method': method, 'amount': amount, **extra}
        return self.client.post(charge_url(self._bill().id), payload, format='json')


class BillCreationTests(BillTestCase):
    def test_first_order_opens_a_bill_for_the_table(self) -> None:
        order = self._order(self.ice_cream)
        bill = self._bill()
        self.assertEqual(order.bill_id, bill.id)
        self.assertEqual(bill.table_number, 5)

    def test_next_orders_join_the_same_bill(self) -> None:
        self._order(self.ice_cream)
        self._order(self.soup)
        self.assertEqual(Bill.objects.filter(table=self.table).count(), 1)
        self.assertEqual(self._bill().orders.count(), 2)

    def test_guest_orders_join_the_open_bill(self) -> None:
        self._order(self.ice_cream)
        payload = {'items': [{'product': self.soup.id, 'quantity': 1}]}
        self.client.post(f'/api/client/{self.table.token}/orders/', payload, format='json')
        self.assertEqual(self._bill().orders.count(), 2)

    def test_current_bill_shows_totals_without_cancelled_orders(self) -> None:
        self._order(self.ice_cream, quantity=2)
        self._order(self.soup, order_status=OrderStatus.CANCELLED)
        self.client.force_authenticate(self.waiter)
        response = self.client.get(CURRENT_URL, {'table': self.table.id})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['totals']['subtotal'], '9.00')
        self.assertEqual(response.data['totals']['balance'], '9.00')
        self.assertEqual(len(response.data['lines']), 2)

    def test_table_without_open_bill_returns_404(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.get(CURRENT_URL, {'table': self.table.id})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_table_returns_404(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.get(CURRENT_URL, {'table': MISSING_ID})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_current_bill_requires_a_numeric_table(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.get(CURRENT_URL, {'table': 'cinco'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_without_view_order_cannot_see_the_bill(self) -> None:
        self._order(self.ice_cream)
        self.client.force_authenticate(create_member())
        response = self.client.get(CURRENT_URL, {'table': self.table.id})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ChargeTests(BillTestCase):
    def setUp(self) -> None:
        super().setUp()
        self._order(self.ice_cream, quantity=2)
        self._order(self.soup)

    def test_full_payment_closes_bill_orders_and_table(self) -> None:
        response = self._charge(self.cashier, '21.00', tip='2.00')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], BillStatus.PAID)
        bill = Bill.objects.get(table=self.table)
        self.assertEqual(bill.subtotal, Decimal('21.00'))
        self.assertEqual(bill.total_paid, Decimal('21.00'))
        self.assertEqual(bill.tip_total, Decimal('2.00'))
        self.assertEqual(bill.closed_by, self.cashier)
        self.assertFalse(Order.objects.filter(bill=bill, close=False).exists())
        self.table.refresh_from_db()
        self.assertFalse(self.table.is_open)
        self.assertIsNone(self.table.bill_requested_at)

    def test_partial_payments_with_different_methods(self) -> None:
        first = self._charge(self.cashier, '10.00', method=PaymentMethod.CARD, reference='VOUCHER-1')
        self.assertEqual(first.data['status'], BillStatus.OPEN)
        self.assertEqual(first.data['totals']['balance'], '11.00')
        second = self._charge(self.cashier, '11.00', method=PaymentMethod.CASH)
        self.assertEqual(second.data['status'], BillStatus.PAID)
        self.assertEqual(Payment.objects.count(), 2)

    def test_tip_does_not_reduce_the_balance(self) -> None:
        response = self._charge(self.cashier, '5.00', tip='3.00')
        self.assertEqual(response.data['totals']['balance'], '16.00')
        self.assertEqual(response.data['totals']['tips'], '3.00')

    def test_overpayment_is_rejected(self) -> None:
        response = self._charge(self.cashier, '21.01')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Payment.objects.exists())

    def test_second_payment_cannot_exceed_the_remaining_balance(self) -> None:
        self._charge(self.cashier, '20.00')
        response = self._charge(self.cashier, '2.00')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Payment.objects.count(), 1)

    def test_zero_amount_is_rejected(self) -> None:
        response = self._charge(self.cashier, '0.00')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('amount', response.data)

    def test_more_than_two_decimals_is_rejected(self) -> None:
        response = self._charge(self.cashier, '1.005')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('amount', response.data)

    def test_invalid_method_is_rejected(self) -> None:
        response = self._charge(self.cashier, '1.00', method='BITCOIN')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('method', response.data)

    def test_negative_tip_is_rejected(self) -> None:
        response = self._charge(self.cashier, '1.00', tip='-1.00')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('tip', response.data)

    def test_final_payment_is_rejected_while_orders_are_in_progress(self) -> None:
        self._order(self.ice_cream, order_status=OrderStatus.PREPARING)
        response = self._charge(self.cashier, '25.50')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pedidos sin entregar', response.data['detail'])
        self.assertFalse(Payment.objects.exists())

    def test_partial_payment_is_allowed_while_orders_are_in_progress(self) -> None:
        self._order(self.ice_cream, order_status=OrderStatus.PREPARING)
        response = self._charge(self.cashier, '10.00')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_orders_without_price_block_the_charge(self) -> None:
        Order.objects.filter(bill=self._bill()).update(price=None)
        response = self._charge(self.cashier, '1.00')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_paid_bill_cannot_be_charged_again(self) -> None:
        bill_id = self._bill().id
        self._charge(self.cashier, '21.00')
        self.client.force_authenticate(self.cashier)
        response = self.client.post(charge_url(bill_id), {'method': 'CASH', 'amount': '1.00'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_waiter_cannot_charge(self) -> None:
        response = self._charge(self.waiter, '21.00')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Payment.objects.exists())

    def test_anonymous_cannot_charge(self) -> None:
        response = self.client.post(charge_url(self._bill().id), {'method': 'CASH', 'amount': '1.00'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_bill_returns_404(self) -> None:
        self.client.force_authenticate(self.cashier)
        response = self.client.post(charge_url(MISSING_ID), {'method': 'CASH', 'amount': '1.00'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_new_order_after_payment_opens_a_new_bill(self) -> None:
        paid_bill_id = self._bill().id
        self._charge(self.cashier, '21.00')
        self._order(self.ice_cream)
        self.assertNotEqual(self._bill().id, paid_bill_id)
        self.assertEqual(self._bill().orders.count(), 1)

    def test_guest_cannot_order_at_a_table_closed_by_payment(self) -> None:
        self._charge(self.cashier, '21.00')
        payload = {'items': [{'product': self.ice_cream.id}]}
        response = self.client.post(f'/api/client/{self.table.token}/orders/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ticket_is_available_to_the_cashier(self) -> None:
        bill_id = self._bill().id
        self._charge(self.cashier, '21.00')
        response = self.client.get(f'{BILLS_URL}{bill_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['totals']['subtotal'], '21.00')
        self.assertEqual(len(response.data['payments']), 1)

    def test_waiter_cannot_open_the_ticket(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.get(f'{BILLS_URL}{self._bill().id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ReversalTests(BillTestCase):
    def setUp(self) -> None:
        super().setUp()
        self._order(self.soup)
        self._charge(self.cashier, '5.00', tip='1.00')
        self.payment = Payment.objects.get()

    def _reverse(self, user, payment_id: int, reason: str = 'Monto equivocado'):
        self.client.force_authenticate(user)
        return self.client.post(reverse_url(payment_id), {'reason': reason}, format='json')

    def test_staff_reverses_a_payment(self) -> None:
        response = self._reverse(self.admin, self.payment.id)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['amount'], '-5.00')
        self.assertEqual(response.data['tip'], '-1.00')
        self.client.force_authenticate(self.cashier)
        current = self.client.get(CURRENT_URL, {'table': self.table.id})
        self.assertEqual(current.data['totals']['balance'], '12.00')
        self.assertTrue(current.data['payments'][0]['is_reversed'])

    def test_payment_cannot_be_reversed_twice(self) -> None:
        self._reverse(self.admin, self.payment.id)
        response = self._reverse(self.admin, self.payment.id)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reversal_cannot_be_reversed(self) -> None:
        reversal_id = self._reverse(self.admin, self.payment.id).data['id']
        response = self._reverse(self.admin, reversal_id)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reversal_requires_a_reason(self) -> None:
        response = self._reverse(self.admin, self.payment.id, reason='')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('reason', response.data)

    def test_paid_bill_cannot_be_reversed(self) -> None:
        self._charge(self.cashier, '7.00')
        response = self._reverse(self.admin, self.payment.id)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cashier_cannot_reverse(self) -> None:
        response = self._reverse(self.cashier, self.payment.id)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_missing_payment_returns_404(self) -> None:
        response = self._reverse(self.admin, MISSING_ID)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_saved_payments_cannot_be_modified(self) -> None:
        self.payment.amount = Decimal('1.00')
        with self.assertRaises(ImmutablePaymentError):
            self.payment.save()


class CloseTableWithBillTests(BillTestCase):
    def _close(self):
        self.client.force_authenticate(self.waiter)
        return self.client.post(f'/api/tables/{self.table.id}/close/')

    def test_table_with_unpaid_bill_cannot_be_closed(self) -> None:
        self._order(self.soup)
        response = self._close()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.table.refresh_from_db()
        self.assertTrue(self.table.is_open)

    def test_table_with_only_cancelled_orders_closes_and_discards_the_empty_bill(self) -> None:
        order = self._order(self.soup, order_status=OrderStatus.CANCELLED)
        response = self._close()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Bill.objects.exists())
        order.refresh_from_db()
        self.assertTrue(order.close)

    def test_reopened_table_starts_a_new_bill(self) -> None:
        self._order(self.soup, order_status=OrderStatus.CANCELLED)
        self._close()
        Table.objects.filter(pk=self.table.pk).update(is_open=True)
        self._order(self.ice_cream)
        self.assertEqual(self._bill().orders.count(), 1)


class PaymentHistoryTests(BillTestCase):
    def setUp(self) -> None:
        super().setUp()
        self._order(self.soup)
        self._charge(self.cashier, '2.00', method=PaymentMethod.CARD)
        self._charge(self.cashier, '10.00', method=PaymentMethod.CASH, tip='1.50')
        self.paid_bill = Bill.objects.get(table=self.table)
        other_table = Table.objects.create(number=9, is_open=True)
        self.table = other_table
        self._order(self.ice_cream)
        self._charge(self.cashier, '4.50', method=PaymentMethod.CASH)
        self.client.force_authenticate(self.cashier)

    def test_lists_paid_bills_newest_first_with_pagination(self) -> None:
        response = self.client.get(BILLS_URL, {'status': BillStatus.PAID})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        self.assertEqual([item['table_number'] for item in response.data['results']], [9, 5])
        self.assertEqual(response.data['results'][1]['methods'], ['CARD', 'CASH'])

    def test_filters_by_table_and_method(self) -> None:
        by_table = self.client.get(BILLS_URL, {'table_number': 5})
        by_method = self.client.get(BILLS_URL, {'method': PaymentMethod.CARD})
        self.assertEqual([item['id'] for item in by_table.data['results']], [self.paid_bill.id])
        self.assertEqual([item['id'] for item in by_method.data['results']], [self.paid_bill.id])

    def test_filters_by_closing_date(self) -> None:
        Bill.objects.filter(pk=self.paid_bill.pk).update(closed_at=timezone.now() - timedelta(days=2))
        since = (timezone.now() - timedelta(days=1)).isoformat()
        response = self.client.get(BILLS_URL, {'closed_at_after': since})
        self.assertEqual([item['table_number'] for item in response.data['results']], [9])

    def test_summary_adds_up_payments_by_method(self) -> None:
        response = self.client.get(SUMMARY_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['bills'], 2)
        self.assertEqual(response.data['total'], '16.50')
        self.assertEqual(response.data['tips'], '1.50')
        by_method = {row['method']: row['amount'] for row in response.data['by_method']}
        self.assertEqual(by_method, {'CARD': '2.00', 'CASH': '14.50'})

    def test_summary_includes_reversals(self) -> None:
        self.table = Table.objects.create(number=11, is_open=True)
        self._order(self.soup)
        self._charge(self.cashier, '3.00', method=PaymentMethod.CARD)
        self.client.force_authenticate(self.admin)
        self.client.post(reverse_url(Payment.objects.latest('id').id), {'reason': 'Error'}, format='json')
        self._charge(self.cashier, '12.00', method=PaymentMethod.CASH)
        response = self.client.get(SUMMARY_URL)
        by_method = {row['method']: row['amount'] for row in response.data['by_method']}
        self.assertEqual(by_method, {'CARD': '2.00', 'CASH': '26.50'})

    def test_waiter_cannot_see_history(self) -> None:
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get(BILLS_URL).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get(SUMMARY_URL).status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_see_history(self) -> None:
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(BILLS_URL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_method_filter_is_rejected(self) -> None:
        response = self.client.get(BILLS_URL, {'method': 'BITCOIN'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AssignOrdersToBillsCommandTests(TestCase):
    def setUp(self) -> None:
        self.table = Table.objects.create(number=1)
        self.other_table = Table.objects.create(number=2)
        for table in (self.table, self.table, self.other_table):
            Order.objects.create(table=table, status=OrderStatus.PENDING, price='1.00')
        Order.objects.create(table=self.table, status=OrderStatus.DELIVERED, close=True)
        Order.objects.create(status=OrderStatus.PENDING)

    def _run(self, *args: str) -> str:
        output = StringIO()
        call_command('assign_orders_to_bills', *args, stdout=output)
        return output.getvalue()

    def test_creates_one_bill_per_table_with_open_orders(self) -> None:
        output = self._run()
        self.assertEqual(Bill.objects.count(), 2)
        self.assertEqual(Bill.objects.get(table=self.table).orders.count(), 2)
        self.assertIn('Pedidos asignados: 3 en 2 mesa(s)', output)

    def test_closed_orders_and_orders_without_table_are_left_alone(self) -> None:
        self._run()
        self.assertEqual(Order.objects.filter(bill__isnull=True).count(), 2)

    def test_is_idempotent(self) -> None:
        self._run()
        output = self._run()
        self.assertEqual(Bill.objects.count(), 2)
        self.assertIn('Pedidos asignados: 0 en 0 mesa(s)', output)

    def test_dry_run_does_not_write(self) -> None:
        output = self._run('--dry-run')
        self.assertFalse(Bill.objects.exists())
        self.assertIn('Pedidos sin cuenta: 3 en 2 mesa(s)', output)
