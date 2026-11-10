from decimal import Decimal

from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework import status

from categories.models import Category
from configuration.models import SETTINGS_ID, PaymentMode, RestaurantSettings, TaxType
from icard.testing import MediaTestCase, create_admin, create_role_member, make_image, seed_roles
from orders.models import Order, OrderStatus
from orders.services import OrderItem, create_orders
from payments.models import Bill, BillStatus, Payment, PaymentMethod
from payments.tax import split_included_tax
from products.models import Product
from tables.models import Table
from users.roles import CASHIER_ROLE, KITCHEN_ROLE, WAITER_ROLE

DISH_PRICE = Decimal('30000.00')
DRINK_PRICE = Decimal('5000.00')


def configure(**values) -> None:
    RestaurantSettings.objects.update_or_create(pk=SETTINGS_ID, defaults=values)


class SplitIncludedTaxTests(SimpleTestCase):
    def test_inc_8_percent_included_in_108000(self) -> None:
        breakdown = split_included_tax(Decimal('108000'), Decimal('8'))
        self.assertEqual((breakdown.base, breakdown.tax), (Decimal('100000.00'), Decimal('8000.00')))

    def test_inc_8_percent_included_in_30000(self) -> None:
        breakdown = split_included_tax(Decimal('30000'), Decimal('8'))
        self.assertEqual((breakdown.base, breakdown.tax), (Decimal('27777.78'), Decimal('2222.22')))

    def test_rounds_half_up_to_cents(self) -> None:
        breakdown = split_included_tax(Decimal('10.00'), Decimal('19'))
        self.assertEqual((breakdown.base, breakdown.tax), (Decimal('8.40'), Decimal('1.60')))

    def test_without_tax_the_base_is_the_total(self) -> None:
        breakdown = split_included_tax(Decimal('30000'), None)
        self.assertEqual((breakdown.base, breakdown.tax), (Decimal('30000.00'), Decimal('0.00')))

    def test_base_plus_tax_always_equals_the_total(self) -> None:
        breakdown = split_included_tax(Decimal('12345.67'), Decimal('8'))
        self.assertEqual(breakdown.base + breakdown.tax, Decimal('12345.67'))


class PhaseFiveTestCase(MediaTestCase):
    def setUp(self) -> None:
        seed_roles()
        category = Category.objects.create(title='Carta', image=make_image())
        self.dish = Product.objects.create(
            title='Bandeja', image=make_image(), price=DISH_PRICE, active=True, category=category
        )
        self.drink = Product.objects.create(
            title='Limonada', image=make_image(), price=DRINK_PRICE, active=True, category=category
        )
        self.table = Table.objects.create(number=5, is_open=True)
        self.admin = create_admin()
        self.waiter = create_role_member(WAITER_ROLE)
        self.cashier = create_role_member(CASHIER_ROLE)
        self.cook = create_role_member(KITCHEN_ROLE)

    def _order(self, product: Product, table: Table | None = None) -> Order:
        [order] = create_orders(table or self.table, [OrderItem(product, 1, '')], self.waiter)
        return order

    def _bill(self, table: Table | None = None) -> Bill:
        return Bill.objects.get(table=table or self.table, status=BillStatus.OPEN)

    def _charge(self, amount: str, orders: list[int] | None = None, **extra):
        self.client.force_authenticate(self.cashier)
        payload = {'method': PaymentMethod.CASH, 'amount': amount, **extra}
        if orders is not None:
            payload['orders'] = orders
        return self.client.post(f'/api/bills/{self._bill().id}/payments/', payload, format='json')


class TaxOnBillsTests(PhaseFiveTestCase):
    def test_bill_copies_the_tax_active_when_it_opens(self) -> None:
        configure(charge_inc=True, inc_rate=Decimal('8'))
        self._order(self.dish)
        bill = self._bill()
        self.assertEqual((bill.tax_type, bill.tax_rate), (TaxType.INC, Decimal('8.00')))

    def test_changing_the_rate_does_not_alter_an_open_bill(self) -> None:
        configure(charge_inc=True, inc_rate=Decimal('8'))
        self._order(self.dish)
        configure(charge_inc=True, inc_rate=Decimal('19'))
        self._order(self.drink)
        other_table = Table.objects.create(number=6, is_open=True)
        self._order(self.dish, table=other_table)
        self.assertEqual(self._bill().tax_rate, Decimal('8.00'))
        self.assertEqual(self._bill(other_table).tax_rate, Decimal('19.00'))

    def test_bill_without_tax_shows_zero_tax(self) -> None:
        self._order(self.dish)
        self.client.force_authenticate(self.waiter)
        response = self.client.get('/api/bills/current/', {'table': self.table.id})
        self.assertEqual(response.data['totals']['tax'], '0.00')
        self.assertEqual(response.data['tax_type'], '')

    def test_tax_is_included_in_the_price_and_does_not_change_the_balance(self) -> None:
        configure(charge_inc=True, inc_rate=Decimal('8'))
        self._order(self.dish)
        self.client.force_authenticate(self.waiter)
        totals = self.client.get('/api/bills/current/', {'table': self.table.id}).data['totals']
        self.assertEqual(totals['balance'], '30000.00')
        self.assertEqual((totals['tax_base'], totals['tax']), ('27777.78', '2222.22'))

    def test_tip_is_not_taxed(self) -> None:
        configure(charge_inc=True, inc_rate=Decimal('8'))
        order = self._order(self.dish)
        Order.objects.filter(pk=order.pk).update(status=OrderStatus.DELIVERED)
        bill_id = self._bill().id
        self._charge('30000.00', tip='3000.00')
        bill = Bill.objects.get(pk=bill_id)
        self.assertEqual((bill.tax_base, bill.tax_amount), (Decimal('27777.78'), Decimal('2222.22')))

    def test_history_summary_adds_up_the_tax(self) -> None:
        configure(charge_inc=True, inc_rate=Decimal('8'))
        order = self._order(self.dish)
        Order.objects.filter(pk=order.pk).update(status=OrderStatus.DELIVERED)
        self._charge('30000.00')
        response = self.client.get('/api/bills/summary/')
        self.assertEqual(response.data['tax'], '2222.22')


class PrepaidFlowTests(PhaseFiveTestCase):
    def setUp(self) -> None:
        super().setUp()
        configure(payment_mode=PaymentMode.PREPAID)
        self.dish_order = self._order(self.dish)
        self.drink_order = self._order(self.drink)

    def _status(self, order: Order) -> str:
        return Order.objects.get(pk=order.pk).status

    def test_orders_wait_for_payment_and_are_hidden_from_the_kitchen(self) -> None:
        self.assertEqual(self._status(self.dish_order), OrderStatus.AWAITING_PAYMENT)
        self.client.force_authenticate(self.cook)
        response = self.client.post(f'/api/orders/{self.dish_order.id}/advance/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_summary_counts_orders_awaiting_payment(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.get('/api/tables/summary/')
        self.assertEqual((response.data[0]['awaiting_payment'], response.data[0]['pending']), (2, 0))

    def test_paying_selected_orders_sends_them_to_the_kitchen(self) -> None:
        response = self._charge('30000.00', orders=[self.dish_order.id])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._status(self.dish_order), OrderStatus.PENDING)
        self.assertEqual(self._status(self.drink_order), OrderStatus.AWAITING_PAYMENT)
        self.assertEqual(Order.objects.get(pk=self.dish_order.pk).payment, Payment.objects.get())
        self.assertEqual(response.data['status'], BillStatus.OPEN)

    def test_amount_must_match_the_selected_orders(self) -> None:
        response = self._charge('30000.00', orders=[self.dish_order.id, self.drink_order.id])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Payment.objects.exists())

    def test_prepaid_charge_requires_orders(self) -> None:
        response = self._charge('35000.00')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_an_order_cannot_be_paid_twice(self) -> None:
        self._charge('30000.00', orders=[self.dish_order.id])
        response = self._charge('30000.00', orders=[self.dish_order.id])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Payment.objects.count(), 1)

    def test_orders_of_another_bill_are_rejected(self) -> None:
        other_table = Table.objects.create(number=6, is_open=True)
        foreign_order = self._order(self.drink, table=other_table)
        response = self._charge('5000.00', orders=[foreign_order.id])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reversing_returns_untouched_orders_to_awaiting_payment(self) -> None:
        self._charge('30000.00', orders=[self.dish_order.id])
        self.client.force_authenticate(self.admin)
        response = self.client.post(f'/api/payments/{Payment.objects.get().id}/reverse/', {'reason': 'Error'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._status(self.dish_order), OrderStatus.AWAITING_PAYMENT)
        self.assertIsNone(Order.objects.get(pk=self.dish_order.pk).payment)

    def test_cannot_reverse_once_the_kitchen_started(self) -> None:
        self._charge('30000.00', orders=[self.dish_order.id])
        Order.objects.filter(pk=self.dish_order.pk).update(status=OrderStatus.PREPARING)
        self.client.force_authenticate(self.admin)
        response = self.client.post(f'/api/payments/{Payment.objects.get().id}/reverse/', {'reason': 'Error'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_paid_order_cannot_be_cancelled_before_reversing(self) -> None:
        self._charge('30000.00', orders=[self.dish_order.id])
        self.client.force_authenticate(self.waiter)
        response = self.client.post(f'/api/orders/{self.dish_order.id}/cancel/', {'reason': 'Se fue'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_an_unpaid_order_can_be_cancelled(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.post(f'/api/orders/{self.drink_order.id}/cancel/', {'reason': 'Se arrepintió'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_table_with_unpaid_orders_cannot_close(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.post(f'/api/tables/{self.table.id}/close/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('sin cobrar', response.data['detail'])

    def test_table_with_orders_in_the_kitchen_cannot_close(self) -> None:
        self._charge('35000.00', orders=[self.dish_order.id, self.drink_order.id])
        self.client.force_authenticate(self.waiter)
        response = self.client.post(f'/api/tables/{self.table.id}/close/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('sin entregar', response.data['detail'])

    def test_closing_a_fully_paid_and_served_table_closes_the_bill(self) -> None:
        bill_id = self._bill().id
        self._charge('35000.00', orders=[self.dish_order.id, self.drink_order.id])
        Order.objects.filter(bill_id=bill_id).update(status=OrderStatus.DELIVERED)
        self.client.force_authenticate(self.waiter)
        response = self.client.post(f'/api/tables/{self.table.id}/close/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bill = Bill.objects.get(pk=bill_id)
        self.assertEqual(
            (bill.status, bill.total_paid, bill.closed_by),
            (BillStatus.PAID, Decimal('35000.00'), self.waiter),
        )
        self.assertFalse(Order.objects.filter(bill_id=bill_id, close=False).exists())

    def test_guest_sees_the_prepaid_mode_and_waits_for_payment(self) -> None:
        response = self.client.get(f'/api/client/{self.table.token}/')
        self.assertEqual(response.data['payment_mode'], PaymentMode.PREPAID)
        payload = {'items': [{'product': self.drink.id}]}
        created = self.client.post(f'/api/client/{self.table.token}/orders/', payload, format='json')
        self.assertEqual(created.data[0]['status'], OrderStatus.AWAITING_PAYMENT)


class PostpaidStillWorksTests(PhaseFiveTestCase):
    def test_postpaid_charge_rejects_an_order_selection(self) -> None:
        order = self._order(self.dish)
        response = self._charge('30000.00', orders=[order.id])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_postpaid_orders_go_straight_to_the_kitchen(self) -> None:
        order = self._order(self.dish)
        self.assertEqual(order.status, OrderStatus.PENDING)

    def test_closing_a_postpaid_table_with_a_balance_is_still_blocked(self) -> None:
        self._order(self.dish)
        Table.objects.filter(pk=self.table.pk).update(bill_requested_at=timezone.now())
        self.client.force_authenticate(self.waiter)
        response = self.client.post(f'/api/tables/{self.table.id}/close/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
