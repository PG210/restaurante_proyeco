import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from configuration.business_day import forget_business_day_start_hour
from icard.testing import create_admin, create_role_member, seed_roles
from payments.cash_register import CashClosingError, CashCount, close_cash_register
from payments.models import Bill, CashClosing, Payment, PaymentMethod
from users.roles import CASHIER_ROLE, KITCHEN_ROLE, WAITER_ROLE

CLOSINGS_URL = '/api/cash-closings/'
TODAY_URL = f'{CLOSINGS_URL}today/'
MISSING_ID = 999999
BOGOTA = ZoneInfo('America/Bogota')
EVENING = datetime.datetime(2026, 11, 11, 22, tzinfo=BOGOTA)


def add_payment(method: str, amount: str, tip: str = '0', at: datetime.datetime | None = None) -> Payment:
    bill = Bill.objects.create(table_number=1)
    payment = Payment.objects.create(bill=bill, method=method, amount=Decimal(amount), tip=Decimal(tip))
    if at is not None:
        Payment.objects.filter(pk=payment.pk).update(created_at=at)
    return payment


def add_reversal(original: Payment, at: datetime.datetime | None = None) -> Payment:
    reversal = Payment.objects.create(
        bill=original.bill,
        method=original.method,
        amount=-original.amount,
        tip=-original.tip,
        reverses=original,
    )
    if at is not None:
        Payment.objects.filter(pk=reversal.pk).update(created_at=at)
    return reversal


def counted(cash: str = '0', card: str = '0', transfer: str = '0') -> dict:
    return {'CASH': cash, 'CARD': card, 'TRANSFER': transfer}


class CashClosingTestCase(APITestCase):
    def setUp(self) -> None:
        seed_roles()
        forget_business_day_start_hour()
        self.addCleanup(forget_business_day_start_hour)
        self.admin = create_admin()
        self.cashier = create_role_member(CASHIER_ROLE)
        self.waiter = create_role_member(WAITER_ROLE)
        self.cook = create_role_member(KITCHEN_ROLE)

    def _close(self, user=None, opening_float='0', note='', **amounts):
        self.client.force_authenticate(user or self.cashier)
        payload = {'opening_float': opening_float, 'counted': counted(**amounts), 'note': note}
        return self.client.post(CLOSINGS_URL, payload, format='json')

    @staticmethod
    def _lines(data: dict) -> dict:
        return {line['method']: line for line in data['lines']}


class ExpectedAmountTests(CashClosingTestCase):
    def test_expected_includes_tips_reversals_and_the_opening_float(self) -> None:
        add_payment(PaymentMethod.CASH, '30000', tip='3000')
        add_reversal(add_payment(PaymentMethod.CASH, '5000'))
        add_payment(PaymentMethod.CARD, '20000', tip='2000')

        response = self._close(opening_float='100000', cash='133000', card='22000')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        lines = self._lines(response.data)
        self.assertEqual(lines['CASH']['expected'], '133000.00')
        self.assertEqual(lines['CARD']['expected'], '22000.00')
        self.assertEqual(lines['TRANSFER']['expected'], '0.00')
        self.assertEqual(response.data['total_difference'], '0.00')
        self.assertFalse(response.data['needs_note'])

    def test_only_payments_of_the_current_service_day_count(self) -> None:
        add_payment(PaymentMethod.CASH, '1000', at=EVENING - datetime.timedelta(days=1))
        add_payment(PaymentMethod.CASH, '2000', at=EVENING)
        add_payment(PaymentMethod.CASH, '4000', at=EVENING + datetime.timedelta(hours=4))

        closing = close_cash_register(
            CashCount(Decimal('0'), {method: Decimal('0') for method in PaymentMethod.values}),
            self.cashier,
            now=EVENING + datetime.timedelta(hours=5),
        )

        self.assertEqual(closing.service_day, datetime.date(2026, 11, 11))
        self.assertEqual(closing.lines.get(method=PaymentMethod.CASH).expected, Decimal('6000.00'))


class DifferenceTests(CashClosingTestCase):
    def setUp(self) -> None:
        super().setUp()
        add_payment(PaymentMethod.CASH, '10000')

    def test_a_shortfall_is_saved_and_asks_for_a_note(self) -> None:
        response = self._close(cash='9000')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._lines(response.data)['CASH']['difference'], '-1000.00')
        self.assertTrue(response.data['needs_note'])

    def test_the_note_is_added_once_after_seeing_the_difference(self) -> None:
        closing_id = self._close(cash='9000').data['id']
        note_url = f'{CLOSINGS_URL}{closing_id}/note/'

        response = self.client.post(note_url, {'text': 'Vuelto mal dado'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['needs_note'])

        again = self.client.post(note_url, {'text': 'Otra cosa'}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CashClosing.objects.get().note, 'Vuelto mal dado')

    def test_a_note_given_when_closing_is_kept(self) -> None:
        response = self._close(cash='11000', note='  Propina sin registrar  ')

        self.assertEqual(response.data['note'], 'Propina sin registrar')
        self.assertFalse(response.data['needs_note'])


class OneClosingPerDayTests(CashClosingTestCase):
    def test_the_day_cannot_be_closed_twice(self) -> None:
        self._close()

        response = self._close()

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(CashClosing.objects.count(), 1)

    def test_the_service_refuses_a_second_closing_too(self) -> None:
        count = CashCount(Decimal('0'), {method: Decimal('0') for method in PaymentMethod.values})
        close_cash_register(count, self.cashier)

        with self.assertRaises(CashClosingError):
            close_cash_register(count, self.cashier)

    def test_admin_voids_with_a_reason_and_the_day_can_be_closed_again(self) -> None:
        closing_id = self._close().data['id']
        self.client.force_authenticate(self.admin)

        response = self.client.post(f'{CLOSINGS_URL}{closing_id}/void/', {'text': 'Conteo equivocado'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['void_reason'], 'Conteo equivocado')
        self.assertEqual(self._close().status_code, status.HTTP_201_CREATED)
        self.assertEqual(CashClosing.objects.count(), 2)

    def test_a_voided_closing_cannot_be_voided_again(self) -> None:
        closing_id = self._close().data['id']
        self.client.force_authenticate(self.admin)
        self.client.post(f'{CLOSINGS_URL}{closing_id}/void/', {'text': 'Error'})

        response = self.client.post(f'{CLOSINGS_URL}{closing_id}/void/', {'text': 'Error'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_today_shows_the_closing_once_saved(self) -> None:
        self.client.force_authenticate(self.cashier)
        self.assertIsNone(self.client.get(TODAY_URL).data['closing'])

        closing_id = self._close().data['id']

        self.assertEqual(self.client.get(TODAY_URL).data['closing']['id'], closing_id)


class ValidationTests(CashClosingTestCase):
    def test_amounts_must_be_complete_and_not_negative(self) -> None:
        self.client.force_authenticate(self.cashier)
        payloads = [
            {'opening_float': '0', 'counted': counted(cash='-1')},
            {'opening_float': '-1', 'counted': counted()},
            {'opening_float': '0', 'counted': {'CASH': '0'}},
            {'counted': counted()},
        ]
        for payload in payloads:
            with self.subTest(payload=payload):
                response = self.client.post(CLOSINGS_URL, payload, format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(CashClosing.objects.exists())


class PermissionTests(CashClosingTestCase):
    def test_anonymous_gets_401(self) -> None:
        self.assertEqual(self.client.get(CLOSINGS_URL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_only_who_can_close_closes(self) -> None:
        for user in (self.waiter, self.cook):
            with self.subTest(user=user.username):
                self.assertEqual(self._close(user=user).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self._close(user=self.admin).status_code, status.HTTP_201_CREATED)

    def test_cashier_sees_the_list_but_kitchen_does_not(self) -> None:
        self._close()
        self.client.force_authenticate(self.cook)
        self.assertEqual(self.client.get(CLOSINGS_URL).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.cashier)
        response = self.client.get(CLOSINGS_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_only_the_admin_voids(self) -> None:
        closing_id = self._close().data['id']
        self.client.force_authenticate(self.cashier)

        response = self.client.post(f'{CLOSINGS_URL}{closing_id}/void/', {'text': 'Error'})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIsNone(CashClosing.objects.get().voided_at)

    def test_missing_closing_gives_404(self) -> None:
        self.client.force_authenticate(self.admin)

        response = self.client.post(f'{CLOSINGS_URL}{MISSING_ID}/void/', {'text': 'Error'})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_closing_time_is_recorded(self) -> None:
        before = timezone.now()
        self._close()
        self.assertGreaterEqual(CashClosing.objects.get().closed_at, before)
