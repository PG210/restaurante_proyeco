from io import StringIO

from django.conf import settings
from django.contrib.auth.models import Group, Permission
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from icard.testing import TEST_PASSWORD, create_admin, create_member, create_role_member, seed_roles
from orders.permissions import ADD_ORDER, CANCEL_ORDER, VIEW_ORDER
from users.models import User
from users.roles import (
    CASHIER_ROLE,
    DEFAULT_ROLE_PERMISSIONS,
    DELEGABLE_PERMISSIONS,
    KITCHEN_ROLE,
    STAFF_ROLES,
    WAITER_ROLE,
)

USERS_URL = '/api/users/'
ME_URL = '/api/auth/me/'
LOGIN_URL = '/api/auth/login/'
REFRESH_URL = '/api/auth/refresh/'
MATRIX_URL = '/api/roles/permissions/'
ORDERS_URL = '/api/orders/'
MISSING_ID = 999999


def user_url(user_id: int) -> str:
    return f'{USERS_URL}{user_id}/'


def role_permissions_url(role: str) -> str:
    return f'/api/roles/{role}/permissions/'


def group_permissions(role: str) -> set[str]:
    return set(Group.objects.get(name=role).permissions.values_list('codename', flat=True))


def login_attempts_allowed() -> int:
    rate = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['login']
    return int(rate.split('/')[0])


class UserApiPermissionTests(APITestCase):
    def setUp(self) -> None:
        self.admin = create_admin()
        self.member = create_member()

    def test_anonymous_cannot_list_users(self) -> None:
        response = self.client.get(USERS_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_cannot_create_user(self) -> None:
        payload = {'username': 'x', 'email': 'x@example.com', 'password': 'X-pass-123', 'is_staff': True}
        response = self.client.post(USERS_URL, payload)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(User.objects.filter(email='x@example.com').exists())

    def test_non_staff_cannot_list_users(self) -> None:
        self.client.force_authenticate(self.member)
        response = self.client.get(USERS_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_staff_cannot_delete_user(self) -> None:
        self.client.force_authenticate(self.member)
        response = self.client.delete(user_url(self.admin.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())

    def test_staff_can_list_users_without_password(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.get(USERS_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for item in response.data:
            self.assertNotIn('password', item)

    def test_missing_user_returns_404(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.get(user_url(MISSING_ID))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_me_requires_authentication(self) -> None:
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_current_user_without_password(self) -> None:
        self.client.force_authenticate(self.member)
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.member.email)
        self.assertNotIn('password', response.data)


class UserApiPasswordTests(APITestCase):
    def setUp(self) -> None:
        self.admin = create_admin()
        self.target = create_member('target')
        self.client.force_authenticate(self.admin)

    def _put_payload(self, password: str) -> dict:
        return {
            'username': 'target',
            'email': 'target@example.com',
            'first_name': 'Nuevo',
            'last_name': 'Nombre',
            'password': password,
            'is_active': True,
            'is_staff': False,
        }

    def test_create_hashes_password(self) -> None:
        payload = {'username': 'new', 'email': 'new@example.com', 'password': 'New-pass-123'}
        response = self.client.post(USERS_URL, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='new@example.com')
        self.assertNotEqual(user.password, 'New-pass-123')
        self.assertTrue(user.check_password('New-pass-123'))

    def test_create_requires_password(self) -> None:
        payload = {'username': 'new', 'email': 'new@example.com', 'password': ''}
        response = self.client.post(USERS_URL, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_put_with_new_password_hashes_it(self) -> None:
        response = self.client.put(user_url(self.target.id), self._put_payload('Changed-pass-123'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertTrue(self.target.check_password('Changed-pass-123'))

    def test_put_with_blank_password_keeps_current(self) -> None:
        response = self.client.put(user_url(self.target.id), self._put_payload(''))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertEqual(self.target.first_name, 'Nuevo')
        self.assertTrue(self.target.check_password(TEST_PASSWORD))

    def test_patch_updates_existing_user_without_creating_new_one(self) -> None:
        count_before = User.objects.count()
        response = self.client.patch(user_url(self.target.id), {'first_name': 'Parcial'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects.count(), count_before)
        self.target.refresh_from_db()
        self.assertEqual(self.target.first_name, 'Parcial')
        self.assertTrue(self.target.check_password(TEST_PASSWORD))

    def test_patch_with_password_hashes_it(self) -> None:
        response = self.client.patch(user_url(self.target.id), {'password': 'Patched-pass-123'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertTrue(self.target.check_password('Patched-pass-123'))


class UserRolesTests(APITestCase):
    def setUp(self) -> None:
        call_command('seed_roles', stdout=StringIO())
        self.admin = create_admin()
        self.target = create_member('target')
        self.client.force_authenticate(self.admin)

    def test_create_user_with_roles(self) -> None:
        payload = {
            'username': 'waiter',
            'email': 'waiter@example.com',
            'password': 'Waiter-pass-123',
            'roles': [WAITER_ROLE, CASHIER_ROLE],
        }
        response = self.client.post(USERS_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertCountEqual(response.data['roles'], [WAITER_ROLE, CASHIER_ROLE])

    def test_unknown_role_is_rejected(self) -> None:
        response = self.client.patch(user_url(self.target.id), {'roles': ['gerente']}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('roles', response.data)

    def test_update_replaces_roles(self) -> None:
        self.target.groups.set(Group.objects.filter(name=WAITER_ROLE))
        response = self.client.patch(user_url(self.target.id), {'roles': [CASHIER_ROLE]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['roles'], [CASHIER_ROLE])

    def test_update_without_roles_keeps_them(self) -> None:
        self.target.groups.set(Group.objects.filter(name=WAITER_ROLE))
        response = self.client.patch(user_url(self.target.id), {'first_name': 'Ana'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['roles'], [WAITER_ROLE])

    def test_me_includes_roles(self) -> None:
        self.target.groups.set(Group.objects.filter(name=WAITER_ROLE))
        self.client.force_authenticate(self.target)
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['roles'], [WAITER_ROLE])


class AuthTokenTests(APITestCase):
    def setUp(self) -> None:
        cache.clear()
        self.member = create_member()

    def _login(self, password: str):
        return self.client.post(LOGIN_URL, {'email': self.member.email, 'password': password})

    def test_login_returns_access_and_refresh(self) -> None:
        response = self._login(TEST_PASSWORD)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_with_wrong_password_is_rejected(self) -> None:
        response = self._login('wrong-password')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_without_fields_is_rejected(self) -> None:
        response = self.client.post(LOGIN_URL, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_is_throttled_after_allowed_attempts(self) -> None:
        for _ in range(login_attempts_allowed()):
            self._login('wrong-password')
        response = self._login(TEST_PASSWORD)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_refresh_returns_new_access_token(self) -> None:
        refresh_token = self._login(TEST_PASSWORD).data['refresh']
        response = self.client.post(REFRESH_URL, {'refresh': refresh_token})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_refreshed_access_token_authenticates(self) -> None:
        refresh_token = self._login(TEST_PASSWORD).data['refresh']
        access_token = self.client.post(REFRESH_URL, {'refresh': refresh_token}).data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_invalid_refresh_token_is_rejected(self) -> None:
        response = self.client.post(REFRESH_URL, {'refresh': 'not-a-token'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SeedRolesCommandTests(TestCase):
    def test_creates_missing_roles(self) -> None:
        call_command('seed_roles', stdout=StringIO())
        self.assertCountEqual(Group.objects.values_list('name', flat=True), STAFF_ROLES)

    def test_is_idempotent(self) -> None:
        call_command('seed_roles', stdout=StringIO())
        output = StringIO()
        call_command('seed_roles', stdout=output)
        self.assertEqual(Group.objects.count(), len(STAFF_ROLES))
        self.assertIn('ya existen', output.getvalue())

    def test_dry_run_does_not_write(self) -> None:
        output = StringIO()
        call_command('seed_roles', '--dry-run', stdout=output)
        self.assertFalse(Group.objects.exists())
        self.assertIn('Se crearían', output.getvalue())


class SeedRolePermissionsTests(TestCase):
    def setUp(self) -> None:
        seed_roles()

    def _delegate_cancel_to_cashier(self) -> None:
        Group.objects.get(name=CASHIER_ROLE).permissions.add(Permission.objects.get(codename=CANCEL_ORDER))

    def test_assigns_default_permissions_to_waiter(self) -> None:
        self.assertEqual(group_permissions(WAITER_ROLE), set(DEFAULT_ROLE_PERMISSIONS[WAITER_ROLE]))

    def test_assigns_default_permissions_to_kitchen(self) -> None:
        self.assertEqual(group_permissions(KITCHEN_ROLE), set(DEFAULT_ROLE_PERMISSIONS[KITCHEN_ROLE]))

    def test_assigns_default_permissions_to_cashier(self) -> None:
        self.assertEqual(group_permissions(CASHIER_ROLE), set(DEFAULT_ROLE_PERMISSIONS[CASHIER_ROLE]))

    def test_keeps_delegated_permissions(self) -> None:
        self._delegate_cancel_to_cashier()
        seed_roles()
        self.assertIn(CANCEL_ORDER, group_permissions(CASHIER_ROLE))

    def test_reset_restores_default_permissions(self) -> None:
        self._delegate_cancel_to_cashier()
        call_command('seed_roles', '--reset', stdout=StringIO())
        self.assertEqual(group_permissions(CASHIER_ROLE), set(DEFAULT_ROLE_PERMISSIONS[CASHIER_ROLE]))

    def test_dry_run_reset_does_not_remove_permissions(self) -> None:
        self._delegate_cancel_to_cashier()
        output = StringIO()
        call_command('seed_roles', '--reset', '--dry-run', stdout=output)
        self.assertIn(CANCEL_ORDER, group_permissions(CASHIER_ROLE))
        self.assertIn(f'[dry-run] {CASHIER_ROLE}', output.getvalue())


class RolePermissionMatrixTests(APITestCase):
    def setUp(self) -> None:
        seed_roles()
        self.admin = create_admin()
        self.cashier = create_role_member(CASHIER_ROLE)

    def _put_cashier_permissions(self, permissions: list[str]):
        return self.client.put(
            role_permissions_url(CASHIER_ROLE), {'permissions': permissions}, format='json'
        )

    def test_staff_reads_matrix(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.get(MATRIX_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codenames = [item['codename'] for item in response.data['permissions']]
        self.assertEqual(codenames, list(DELEGABLE_PERMISSIONS))
        roles = {role['name']: role for role in response.data['roles']}
        self.assertEqual(set(roles[KITCHEN_ROLE]['permissions']), set(DEFAULT_ROLE_PERMISSIONS[KITCHEN_ROLE]))
        self.assertEqual(set(roles[KITCHEN_ROLE]['defaults']), set(DEFAULT_ROLE_PERMISSIONS[KITCHEN_ROLE]))

    def test_defaults_do_not_change_when_permissions_are_delegated(self) -> None:
        self.client.force_authenticate(self.admin)
        self._put_cashier_permissions([VIEW_ORDER, ADD_ORDER])
        response = self.client.get(MATRIX_URL)
        cashier = next(role for role in response.data['roles'] if role['name'] == CASHIER_ROLE)
        self.assertEqual(cashier['permissions'], sorted([VIEW_ORDER, ADD_ORDER]))
        self.assertEqual(cashier['defaults'], sorted(DEFAULT_ROLE_PERMISSIONS[CASHIER_ROLE]))

    def test_non_staff_cannot_read_matrix(self) -> None:
        self.client.force_authenticate(self.cashier)
        response = self.client.get(MATRIX_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_read_matrix(self) -> None:
        response = self.client.get(MATRIX_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delegated_permission_reaches_the_user(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self._put_cashier_permissions([VIEW_ORDER, ADD_ORDER])
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(group_permissions(CASHIER_ROLE), {VIEW_ORDER, ADD_ORDER})

        self.client.force_authenticate(User.objects.get(pk=self.cashier.pk))
        response = self.client.get(ME_URL)
        self.assertIn(ADD_ORDER, response.data['permissions'])

    def test_revoked_permission_blocks_the_api(self) -> None:
        self.client.force_authenticate(self.admin)
        self._put_cashier_permissions([])
        self.client.force_authenticate(User.objects.get(pk=self.cashier.pk))
        response = self.client.get(ORDERS_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_delegable_permission_is_rejected(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self._put_cashier_permissions(['add_user'])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('permissions', response.data)

    def test_missing_permissions_field_is_rejected(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.put(role_permissions_url(CASHIER_ROLE), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unknown_role_returns_404(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.put(role_permissions_url('gerente'), {'permissions': []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_staff_cannot_change_matrix(self) -> None:
        self.client.force_authenticate(self.cashier)
        response = self._put_cashier_permissions(list(DELEGABLE_PERMISSIONS))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(group_permissions(CASHIER_ROLE), set(DEFAULT_ROLE_PERMISSIONS[CASHIER_ROLE]))


class MePermissionsTests(APITestCase):
    def setUp(self) -> None:
        seed_roles()

    def test_role_member_gets_role_permissions(self) -> None:
        self.client.force_authenticate(create_role_member(KITCHEN_ROLE))
        response = self.client.get(ME_URL)
        self.assertCountEqual(response.data['permissions'], DEFAULT_ROLE_PERMISSIONS[KITCHEN_ROLE])

    def test_staff_gets_every_delegable_permission(self) -> None:
        self.client.force_authenticate(create_admin())
        response = self.client.get(ME_URL)
        self.assertEqual(response.data['permissions'], list(DELEGABLE_PERMISSIONS))

    def test_user_without_role_gets_no_permissions(self) -> None:
        self.client.force_authenticate(create_member())
        response = self.client.get(ME_URL)
        self.assertEqual(response.data['permissions'], [])
