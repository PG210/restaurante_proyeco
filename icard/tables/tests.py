from rest_framework import status
from rest_framework.test import APITestCase

from icard.testing import create_admin, create_member, create_role_member, seed_roles
from orders.models import Order, OrderStatus
from tables.models import Table
from users.roles import CASHIER_ROLE

TABLES_URL = '/api/tables/'
SUMMARY_URL = f'{TABLES_URL}summary/'
MISSING_ID = 999999


def table_url(table_id: int) -> str:
    return f'{TABLES_URL}{table_id}/'


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

    def test_member_cannot_create_table(self) -> None:
        self.client.force_authenticate(self.member)
        response = self.client.post(TABLES_URL, {'number': 3})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Table.objects.filter(number=3).exists())

    def test_staff_can_create_table(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.post(TABLES_URL, {'number': 3})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

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


class TableSummaryTests(APITestCase):
    def setUp(self) -> None:
        seed_roles()
        self.first_table = Table.objects.create(number=1)
        self.second_table = Table.objects.create(number=2)
        for order_status in (
            OrderStatus.PENDING,
            OrderStatus.PENDING,
            OrderStatus.READY,
            OrderStatus.DELIVERED,
        ):
            Order.objects.create(table=self.first_table, status=order_status)
        Order.objects.create(table=self.first_table, status=OrderStatus.PENDING, close=True)

    def test_counts_open_orders_by_status(self) -> None:
        self.client.force_authenticate(create_role_member(CASHIER_ROLE))
        response = self.client.get(SUMMARY_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            [
                {'id': self.first_table.id, 'number': 1, 'pending': 2, 'preparing': 0, 'ready': 1},
                {'id': self.second_table.id, 'number': 2, 'pending': 0, 'preparing': 0, 'ready': 0},
            ],
        )

    def test_user_without_view_order_cannot_see_summary(self) -> None:
        self.client.force_authenticate(create_member())
        response = self.client.get(SUMMARY_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_see_summary(self) -> None:
        response = self.client.get(SUMMARY_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
