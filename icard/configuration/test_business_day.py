import datetime
from unittest import mock
from zoneinfo import ZoneInfo

from rest_framework import status
from rest_framework.test import APITestCase

from configuration.business_day import business_day_start_hour, forget_business_day_start_hour
from configuration.models import SettingsChange
from icard.testing import create_admin, create_role_member, seed_roles
from products.service_day import current_service_day
from users.roles import CASHIER_ROLE, WAITER_ROLE

SETTINGS_URL = '/api/settings/'
BOGOTA = ZoneInfo('America/Bogota')
THREE_AM = datetime.datetime(2026, 11, 11, 3, tzinfo=BOGOTA)


class BusinessDayStartHourTests(APITestCase):
    def setUp(self) -> None:
        seed_roles()
        forget_business_day_start_hour()
        self.addCleanup(forget_business_day_start_hour)
        self.admin = create_admin()

    def _patch(self, user, hour):
        self.client.force_authenticate(user)
        return self.client.patch(SETTINGS_URL, {'business_day_start_hour': hour}, format='json')

    def test_defaults_to_five_in_the_morning(self) -> None:
        self.client.force_authenticate(self.admin)

        self.assertEqual(self.client.get(SETTINGS_URL).data['business_day_start_hour'], 5)
        self.assertEqual(current_service_day(THREE_AM), datetime.date(2026, 11, 10))

    def test_admin_moves_the_start_of_the_day_and_it_applies_at_once(self) -> None:
        current_service_day(THREE_AM)

        response = self._patch(self.admin, 2)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['business_day_start_hour'], 2)
        self.assertEqual(current_service_day(THREE_AM), datetime.date(2026, 11, 11))

    def test_the_change_is_recorded_in_the_history(self) -> None:
        self._patch(self.admin, 14)

        change = SettingsChange.objects.get(field='business_day_start_hour')
        self.assertEqual((change.old_value, change.new_value), ('5', '14'))

    def test_hours_outside_the_day_are_rejected(self) -> None:
        for hour in (24, -1, 'tarde'):
            with self.subTest(hour=hour):
                self.assertEqual(self._patch(self.admin, hour).status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_the_admin_changes_it(self) -> None:
        for role in (WAITER_ROLE, CASHIER_ROLE):
            with self.subTest(role=role):
                response = self._patch(create_role_member(role), 0)
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_the_hour_is_read_from_the_cache_after_the_first_time(self) -> None:
        business_day_start_hour()

        with self.assertNumQueries(0):
            business_day_start_hour()

    def test_falls_back_to_the_environment_before_settings_exist(self) -> None:
        with mock.patch('configuration.business_day.RestaurantSettings.objects.filter') as stored:
            stored.return_value.values_list.return_value.first.return_value = None
            with self.settings(BUSINESS_DAY_START_HOUR=7):
                self.assertEqual(business_day_start_hour(), 7)
