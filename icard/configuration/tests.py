from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from configuration.models import (
    SETTINGS_ID,
    ImmutableSettingsChangeError,
    PaymentMode,
    RestaurantSettings,
    SettingsChange,
)
from icard.testing import create_admin, create_role_member, seed_roles
from payments.models import Bill
from tables.models import Table
from users.roles import WAITER_ROLE

SETTINGS_URL = '/api/settings/'
CHANGES_URL = '/api/settings/changes/'


class SettingsApiTests(APITestCase):
    def setUp(self) -> None:
        seed_roles()
        self.admin = create_admin()
        self.waiter = create_role_member(WAITER_ROLE)

    def _patch(self, payload: dict, user=None):
        self.client.force_authenticate(user or self.admin)
        return self.client.patch(SETTINGS_URL, payload, format='json')

    def test_defaults_charge_no_tax_and_bill_at_the_end(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.get(SETTINGS_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {
                key: response.data[key]
                for key in ('charge_inc', 'inc_rate', 'charge_iva', 'iva_rate', 'payment_mode')
            },
            {
                'charge_inc': False,
                'inc_rate': None,
                'charge_iva': False,
                'iva_rate': None,
                'payment_mode': PaymentMode.POSTPAID,
            },
        )

    def test_anonymous_cannot_read_settings(self) -> None:
        self.assertEqual(self.client.get(SETTINGS_URL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_staff_activates_inc_with_its_rate(self) -> None:
        response = self._patch({'charge_inc': True, 'inc_rate': '8.00'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['charge_inc'])
        self.assertEqual(response.data['inc_rate'], '8.00')

    def test_activating_inc_without_a_rate_is_rejected(self) -> None:
        response = self._patch({'charge_inc': True})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('inc_rate', response.data)

    def test_activating_iva_while_inc_is_active_is_rejected(self) -> None:
        self._patch({'charge_inc': True, 'inc_rate': '8.00'})
        response = self._patch({'charge_iva': True, 'iva_rate': '19.00'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', response.data)
        self.assertFalse(RestaurantSettings.objects.get().charge_iva)

    def test_switching_from_inc_to_iva_in_one_request(self) -> None:
        self._patch({'charge_inc': True, 'inc_rate': '8.00'})
        response = self._patch({'charge_inc': False, 'charge_iva': True, 'iva_rate': '19.00'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['charge_iva'])

    def test_rate_above_100_is_rejected(self) -> None:
        response = self._patch({'charge_inc': True, 'inc_rate': '100.01'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('inc_rate', response.data)

    def test_zero_rate_is_rejected(self) -> None:
        response = self._patch({'charge_inc': True, 'inc_rate': '0'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deactivating_a_tax_keeps_its_rate(self) -> None:
        self._patch({'charge_inc': True, 'inc_rate': '8.00'})
        response = self._patch({'charge_inc': False})
        self.assertFalse(response.data['charge_inc'])
        self.assertEqual(response.data['inc_rate'], '8.00')

    def test_invalid_payment_mode_is_rejected(self) -> None:
        response = self._patch({'payment_mode': 'NEVER'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_waiter_cannot_change_settings(self) -> None:
        response = self._patch({'charge_inc': True, 'inc_rate': '8.00'}, user=self.waiter)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_change_settings(self) -> None:
        response = self.client.patch(SETTINGS_URL, {'charge_inc': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_payment_mode_cannot_change_with_open_bills(self) -> None:
        table = Table.objects.create(number=1)
        Bill.objects.create(table=table, table_number=1)
        response = self._patch({'payment_mode': PaymentMode.PREPAID})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(RestaurantSettings.objects.get().payment_mode, PaymentMode.POSTPAID)

    def test_payment_mode_changes_without_open_bills(self) -> None:
        response = self._patch({'payment_mode': PaymentMode.PREPAID})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['payment_mode'], PaymentMode.PREPAID)

    def test_tax_can_change_with_open_bills(self) -> None:
        table = Table.objects.create(number=1)
        Bill.objects.create(table=table, table_number=1)
        response = self._patch({'charge_inc': True, 'inc_rate': '8.00'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class SettingsHistoryTests(APITestCase):
    def setUp(self) -> None:
        seed_roles()
        self.admin = create_admin()
        self.client.force_authenticate(self.admin)

    def test_each_changed_field_is_recorded(self) -> None:
        self.client.patch(SETTINGS_URL, {'charge_inc': True, 'inc_rate': '8.00'}, format='json')
        response = self.client.get(CHANGES_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        recorded = {
            (item['field'], item['old_value'], item['new_value']) for item in response.data['results']
        }
        self.assertEqual(recorded, {('charge_inc', 'False', 'True'), ('inc_rate', '', '8.00')})
        self.assertTrue(all(item['changed_by_name'] for item in response.data['results']))

    def test_unchanged_values_are_not_recorded(self) -> None:
        self.client.patch(SETTINGS_URL, {'payment_mode': PaymentMode.POSTPAID}, format='json')
        self.assertFalse(SettingsChange.objects.exists())

    def test_waiter_cannot_see_the_history(self) -> None:
        self.client.force_authenticate(create_role_member(WAITER_ROLE))
        self.assertEqual(self.client.get(CHANGES_URL).status_code, status.HTTP_403_FORBIDDEN)

    def test_recorded_changes_cannot_be_modified(self) -> None:
        change = SettingsChange.objects.create(field='charge_inc', old_value='False', new_value='True')
        change.new_value = 'False'
        with self.assertRaises(ImmutableSettingsChangeError):
            change.save()


class SettingsConstraintTests(TestCase):
    def test_only_one_settings_row_can_exist(self) -> None:
        with self.assertRaises(IntegrityError), transaction.atomic():
            RestaurantSettings.objects.create(id=SETTINGS_ID + 1)

    def test_database_rejects_inc_and_iva_together(self) -> None:
        with self.assertRaises(IntegrityError), transaction.atomic():
            RestaurantSettings.objects.create(
                charge_inc=True, inc_rate=Decimal('8'), charge_iva=True, iva_rate=Decimal('19')
            )

    def test_database_rejects_an_active_tax_without_rate(self) -> None:
        with self.assertRaises(IntegrityError), transaction.atomic():
            RestaurantSettings.objects.create(charge_inc=True)
