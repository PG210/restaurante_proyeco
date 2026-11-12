from decimal import Decimal

from django.test import TestCase

from configuration.models import SETTINGS_ID, PaymentMode, RestaurantSettings
from icard.testing import create_admin
from orders.models import ImmutableStatusChangeError, Order, OrderStatus, OrderStatusChange
from orders.services import (
    OrderItem,
    OrderTransitionError,
    advance_order,
    advance_orders,
    cancel_order,
    create_orders,
)
from payments.models import PaymentMethod
from payments.services import ChargeRequest, charge, reverse_payment
from products.models import Product
from tables.models import Table


def history(order: Order) -> list[tuple[str, str]]:
    return list(order.status_changes.values_list('from_status', 'to_status'))


class StatusHistoryTests(TestCase):
    def setUp(self) -> None:
        self.admin = create_admin()
        self.table = Table.objects.create(number=3, is_open=True)
        self.product = Product.objects.create(
            title='Sopa', image='products/test.png', price=Decimal('10.00'), active=True
        )

    def _create(self, count: int = 1, user=None) -> list[Order]:
        items = [OrderItem(product=self.product, quantity=1, notes='') for _ in range(count)]
        return create_orders(self.table, items, user)

    def test_a_new_order_records_that_it_entered_the_kitchen(self) -> None:
        [order] = self._create(user=self.admin)

        change = order.status_changes.get()
        self.assertEqual((change.from_status, change.to_status), ('', OrderStatus.PENDING))
        self.assertEqual(change.changed_at, order.kitchen_at)
        self.assertEqual(change.changed_by, self.admin)

    def test_a_menu_order_has_no_user(self) -> None:
        [order] = self._create()

        self.assertIsNone(order.status_changes.get().changed_by)

    def test_each_step_records_who_and_from_where(self) -> None:
        [order] = self._create()

        advance_order(order, self.admin)
        advance_order(order, self.admin)
        advance_order(order, self.admin)

        self.assertEqual(
            history(order),
            [
                ('', OrderStatus.PENDING),
                (OrderStatus.PENDING, OrderStatus.PREPARING),
                (OrderStatus.PREPARING, OrderStatus.READY),
                (OrderStatus.READY, OrderStatus.DELIVERED),
            ],
        )

    def test_orders_advanced_together_share_the_time(self) -> None:
        first, second = self._create(2)
        advance_order(first, self.admin)

        advance_orders([first.pk, second.pk], self.admin)

        ready = OrderStatusChange.objects.get(order=first, to_status=OrderStatus.READY)
        preparing = OrderStatusChange.objects.get(order=second, to_status=OrderStatus.PREPARING)
        self.assertEqual(ready.from_status, OrderStatus.PREPARING)
        self.assertEqual(ready.changed_at, preparing.changed_at)

    def test_cancelling_records_who_cancelled(self) -> None:
        [order] = self._create()

        cancel_order(order, 'Se demoró', self.admin)

        change = order.status_changes.get(to_status=OrderStatus.CANCELLED)
        self.assertEqual((change.from_status, change.changed_by), (OrderStatus.PENDING, self.admin))

    def test_prepaid_charge_and_its_reversal_are_recorded(self) -> None:
        RestaurantSettings.objects.update_or_create(
            pk=SETTINGS_ID, defaults={'payment_mode': PaymentMode.PREPAID}
        )
        [order] = self._create()
        request = ChargeRequest(
            method=PaymentMethod.CASH,
            amount=Decimal('10.00'),
            tip=Decimal('0'),
            reference='',
            order_ids=(order.pk,),
        )

        charge(order.bill, request, self.admin)
        reverse_payment(order.bill.payments.get(), 'Error', self.admin)

        self.assertEqual(
            history(order),
            [
                ('', OrderStatus.AWAITING_PAYMENT),
                (OrderStatus.AWAITING_PAYMENT, OrderStatus.PENDING),
                (OrderStatus.PENDING, OrderStatus.AWAITING_PAYMENT),
            ],
        )

    def test_failed_changes_leave_no_trace(self) -> None:
        [order] = self._create()
        cancel_order(order, '', self.admin)

        with self.assertRaises(OrderTransitionError):
            advance_order(order, self.admin)

        self.assertEqual(order.status_changes.count(), 2)

    def test_the_history_cannot_be_edited(self) -> None:
        [order] = self._create()
        change = order.status_changes.get()

        change.to_status = OrderStatus.READY
        with self.assertRaises(ImmutableStatusChangeError):
            change.save()
