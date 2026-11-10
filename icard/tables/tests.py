from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from icard.testing import create_admin, create_member, create_role_member, seed_roles
from orders.models import Order, OrderStatus
from tables.models import Table
from users.roles import CASHIER_ROLE, KITCHEN_ROLE, WAITER_ROLE

TABLES_URL = '/api/tables/'
SUMMARY_URL = f'{TABLES_URL}summary/'
MISSING_ID = 999999


def table_url(table_id: int, action: str = '') -> str:
    suffix = f'{action}/' if action else ''
    return f'{TABLES_URL}{table_id}/{suffix}'


class TableApiTests(APITestCase):
    def setUp(self) -> None:
        self.table = Table.objects.create(number=2)
        Table.objects.create(number=1)
        self.admin = create_admin()
        self.member = create_member()

    def test_anonymous_cannot_list_tables(self) -> None:
        response = self.client.get(TABLES_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_member_can_list_tables_ordered_by_number(self) -> None:
        self.client.force_authenticate(self.member)
        response = self.client.get(TABLES_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['number'] for item in response.data], [1, 2])

    def test_member_does_not_see_the_qr_token(self) -> None:
        self.client.force_authenticate(self.member)
        response = self.client.get(table_url(self.table.id))
        self.assertNotIn('token', response.data)
        self.assertEqual(response.data['is_open'], False)

    def test_staff_sees_the_qr_token(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.get(table_url(self.table.id))
        self.assertEqual(response.data['token'], str(self.table.token))

    def test_member_cannot_create_table(self) -> None:
        self.client.force_authenticate(self.member)
        response = self.client.post(TABLES_URL, {'number': 3})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Table.objects.filter(number=3).exists())

    def test_staff_can_create_table_with_token(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.post(TABLES_URL, {'number': 3})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(Table.objects.get(number=3).token)

    def test_table_cannot_be_opened_through_create(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.post(TABLES_URL, {'number': 3, 'is_open': True})
        self.assertEqual(response.data['is_open'], False)

    def test_duplicate_table_number_is_rejected(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.post(TABLES_URL, {'number': 2})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('number', response.data)

    def test_staff_can_update_table(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.put(table_url(self.table.id), {'number': 20})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.table.refresh_from_db()
        self.assertEqual(self.table.number, 20)

    def test_missing_table_returns_404(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.get(table_url(MISSING_ID))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class TableStateTests(APITestCase):
    def setUp(self) -> None:
        seed_roles()
        self.table = Table.objects.create(number=1)
        self.waiter = create_role_member(WAITER_ROLE)
        self.cook = create_role_member(KITCHEN_ROLE)
        self.cashier = create_role_member(CASHIER_ROLE)

    def _post(self, user, action: str, table_id: int | None = None):
        self.client.force_authenticate(user)
        return self.client.post(table_url(table_id or self.table.id, action))

    def test_waiter_opens_table(self) -> None:
        response = self._post(self.waiter, 'open')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_open'])
        self.assertIsNotNone(response.data['opened_at'])

    def test_opening_an_open_table_keeps_the_opening_time(self) -> None:
        first_opened_at = self._post(self.waiter, 'open').data['opened_at']
        second_opened_at = self._post(self.waiter, 'open').data['opened_at']
        self.assertEqual(first_opened_at, second_opened_at)

    def test_cook_cannot_open_table(self) -> None:
        response = self._post(self.cook, 'open')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.table.refresh_from_db()
        self.assertFalse(self.table.is_open)

    def test_open_table_permission_can_be_delegated_from_the_matrix(self) -> None:
        self.client.force_authenticate(create_admin())
        self.client.put(
            '/api/roles/cocina/permissions/', {'permissions': ['view_order', 'open_table']}, format='json'
        )
        response = self._post(type(self.cook).objects.get(pk=self.cook.pk), 'open')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_cannot_open_table(self) -> None:
        response = self.client.post(table_url(self.table.id, 'open'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_closing_clears_the_bill_request(self) -> None:
        Table.objects.filter(pk=self.table.pk).update(is_open=True, bill_requested_at=timezone.now())
        response = self._post(self.waiter, 'close')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_open'])
        self.assertFalse(response.data['bill_requested'])

    def test_cashier_attends_bill_request(self) -> None:
        Table.objects.filter(pk=self.table.pk).update(is_open=True, bill_requested_at=timezone.now())
        response = self._post(self.cashier, 'attend-bill')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['bill_requested'])

    def test_cook_cannot_attend_bill_request(self) -> None:
        response = self._post(self.cook, 'attend-bill')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_open_missing_table_returns_404(self) -> None:
        response = self._post(self.waiter, 'open', MISSING_ID)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_staff_regenerates_token(self) -> None:
        previous_token = self.table.token
        response = self._post(create_admin(), 'regenerate-token')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.table.refresh_from_db()
        self.assertNotEqual(self.table.token, previous_token)
        self.assertEqual(response.data['token'], str(self.table.token))

    def test_waiter_cannot_regenerate_token(self) -> None:
        previous_token = self.table.token
        response = self._post(self.waiter, 'regenerate-token')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.table.refresh_from_db()
        self.assertEqual(self.table.token, previous_token)


class TableSummaryTests(APITestCase):
    def setUp(self) -> None:
        seed_roles()
        self.first_table = Table.objects.create(number=1, is_open=True)
        self.second_table = Table.objects.create(number=2)
        statuses = (OrderStatus.PENDING, OrderStatus.PENDING, OrderStatus.READY, OrderStatus.DELIVERED)
        for order_status in statuses:
            Order.objects.create(table=self.first_table, status=order_status)
        Order.objects.create(table=self.first_table, status=OrderStatus.PENDING, close=True)

    def test_counts_open_orders_by_status(self) -> None:
        self.client.force_authenticate(create_role_member(CASHIER_ROLE))
        response = self.client.get(SUMMARY_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        expected = [
            {
                'id': self.first_table.id,
                'number': 1,
                'is_open': True,
                'bill_requested': False,
                'pending': 2,
                'preparing': 0,
                'ready': 1,
            },
            {
                'id': self.second_table.id,
                'number': 2,
                'is_open': False,
                'bill_requested': False,
                'pending': 0,
                'preparing': 0,
                'ready': 0,
            },
        ]
        self.assertEqual([dict(item) for item in response.data], expected)

    def test_summary_shows_bill_requests(self) -> None:
        Table.objects.filter(pk=self.first_table.pk).update(bill_requested_at=timezone.now())
        self.client.force_authenticate(create_role_member(CASHIER_ROLE))
        response = self.client.get(SUMMARY_URL)
        self.assertTrue(response.data[0]['bill_requested'])

    def test_user_without_view_order_cannot_see_summary(self) -> None:
        self.client.force_authenticate(create_member())
        response = self.client.get(SUMMARY_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_see_summary(self) -> None:
        response = self.client.get(SUMMARY_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class GenerateTableTokensCommandTests(TestCase):
    def setUp(self) -> None:
        Table.objects.create(number=1)
        Table.objects.create(number=2)
        Table.objects.update(token=None)

    def _run(self, *args: str) -> str:
        output = StringIO()
        call_command('generate_table_tokens', *args, stdout=output)
        return output.getvalue()

    def test_assigns_a_distinct_token_to_each_table(self) -> None:
        output = self._run()
        tokens = list(Table.objects.values_list('token', flat=True))
        self.assertNotIn(None, tokens)
        self.assertEqual(len(set(tokens)), 2)
        self.assertIn('Tokens generados: 2', output)

    def test_dry_run_does_not_write(self) -> None:
        output = self._run('--dry-run')
        self.assertFalse(Table.objects.filter(token__isnull=False).exists())
        self.assertIn('Mesas sin token: 2', output)

    def test_is_idempotent(self) -> None:
        self._run()
        tokens_before = set(Table.objects.values_list('token', flat=True))
        output = self._run()
        self.assertEqual(set(Table.objects.values_list('token', flat=True)), tokens_before)
        self.assertIn('Tokens generados: 0', output)
