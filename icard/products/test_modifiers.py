from decimal import Decimal

from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status

from categories.models import Category
from icard.testing import MediaTestCase, create_admin, create_role_member, make_image, seed_roles
from orders.models import Order, OrderModifier
from payments.models import Bill
from payments.services import bill_totals
from products.models import Modifier, ModifierGroup, Product
from tables.models import Table
from users.roles import WAITER_ROLE

PRODUCTS_URL = '/api/products/'
GROUPS_URL = '/api/modifier-groups/'
ORDERS_URL = '/api/orders/'
BULK_URL = f'{ORDERS_URL}bulk/'
MISSING_ID = 999999


def group_url(group_id: int) -> str:
    return f'{GROUPS_URL}{group_id}/'


class ModifierTestCase(MediaTestCase):
    def setUp(self) -> None:
        cache.clear()
        seed_roles()
        category = Category.objects.create(title='Platos', image=make_image())
        self.burger = Product.objects.create(
            title='Hamburguesa', image=make_image(), price='20.00', active=True, category=category
        )
        self.juice = Product.objects.create(
            title='Jugo', image=make_image(), price='5.00', active=True, category=category
        )
        self.doneness = ModifierGroup.objects.create(name='Término', min_choices=1, max_choices=1, position=0)
        self.medium = Modifier.objects.create(group=self.doneness, name='Medio', position=0)
        self.well_done = Modifier.objects.create(group=self.doneness, name='Bien cocida', position=1)
        self.extras = ModifierGroup.objects.create(name='Extras', min_choices=0, max_choices=2, position=1)
        self.cheese = Modifier.objects.create(group=self.extras, name='Queso', price_delta='3.00', position=0)
        self.bacon = Modifier.objects.create(
            group=self.extras, name='Tocineta', price_delta='4.50', position=1
        )
        self.egg = Modifier.objects.create(group=self.extras, name='Huevo', price_delta='2.00', position=2)
        self.burger.modifier_groups.set([self.doneness, self.extras])
        self.table = Table.objects.create(number=3, is_open=True)
        self.admin = create_admin()
        self.waiter = create_role_member(WAITER_ROLE)

    def _order(self, modifiers: list[int], product: Product | None = None):
        self.client.force_authenticate(self.waiter)
        payload = {
            'table': self.table.id,
            'items': [{'product': (product or self.burger).id, 'quantity': 2, 'modifiers': modifiers}],
        }
        return self.client.post(BULK_URL, payload, format='json')


class OrderWithModifiersTests(ModifierTestCase):
    def test_order_adds_the_options_to_the_unit_price_and_copies_them(self) -> None:
        response = self._order([self.bacon.id, self.medium.id, self.cheese.id])

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        order = Order.objects.get()
        self.assertEqual(order.price, Decimal('27.50'))
        self.assertEqual(
            list(order.modifiers.values_list('group_name', 'modifier_name', 'price_delta')),
            [
                ('Término', 'Medio', Decimal('0.00')),
                ('Extras', 'Queso', Decimal('3.00')),
                ('Extras', 'Tocineta', Decimal('4.50')),
            ],
        )
        self.assertEqual(
            [item['modifier_name'] for item in response.data[0]['modifiers']], ['Medio', 'Queso', 'Tocineta']
        )

    def test_guest_order_with_options(self) -> None:
        payload = {'items': [{'product': self.burger.id, 'quantity': 1, 'modifiers': [self.well_done.id]}]}
        response = self.client.post(f'/api/client/{self.table.token}/orders/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data[0]['price'], '20.00')
        self.assertEqual(response.data[0]['modifiers'][0]['modifier_name'], 'Bien cocida')

    def test_product_without_groups_is_ordered_as_before(self) -> None:
        response = self._order([], product=self.juice)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Order.objects.get().price, Decimal('5.00'))
        self.assertFalse(OrderModifier.objects.exists())

    def test_bill_total_and_lines_include_the_options(self) -> None:
        self._order([self.medium.id, self.cheese.id])

        bill = Bill.objects.get(table=self.table)
        self.assertEqual(bill_totals(bill).subtotal, Decimal('46.00'))
        self.client.force_authenticate(self.admin)
        response = self.client.get(f'/api/bills/{bill.id}/')
        line = response.data['lines'][0]
        self.assertEqual(line['line_total'], '46.00')
        self.assertEqual([item['modifier_name'] for item in line['modifiers']], ['Medio', 'Queso'])

    def test_changing_or_deleting_an_option_keeps_past_orders(self) -> None:
        self._order([self.medium.id, self.cheese.id])

        Modifier.objects.filter(pk=self.cheese.pk).update(name='Queso doble', price_delta='9.00')
        self.cheese.refresh_from_db()
        self.cheese.delete()

        order = Order.objects.get()
        self.assertEqual(order.price, Decimal('23.00'))
        self.assertEqual(
            list(order.modifiers.values_list('modifier_name', 'price_delta', 'modifier')),
            [('Medio', Decimal('0.00'), self.medium.id), ('Queso', Decimal('3.00'), None)],
        )


class InvalidSelectionTests(ModifierTestCase):
    def _assert_rejected(self, modifiers: list[int], message: str) -> None:
        response = self._order(modifiers)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(str(response.data['items'][0]['modifiers'][0]), message)
        self.assertFalse(Order.objects.exists())

    def test_required_option_is_missing(self) -> None:
        self._assert_rejected([self.cheese.id], 'Elige 1 opción en Término.')

    def test_too_many_options(self) -> None:
        self._assert_rejected(
            [self.medium.id, self.cheese.id, self.bacon.id, self.egg.id], 'Elige como máximo 2 en Extras.'
        )

    def test_two_options_in_a_single_choice_group(self) -> None:
        self._assert_rejected([self.medium.id, self.well_done.id], 'Elige 1 opción en Término.')

    def test_option_of_a_group_the_product_does_not_offer(self) -> None:
        sauces = ModifierGroup.objects.create(name='Salsas', max_choices=1)
        bbq = Modifier.objects.create(group=sauces, name='BBQ')

        self._assert_rejected(
            [self.medium.id, bbq.id], 'Hay opciones que no están disponibles para Hamburguesa.'
        )

    def test_inactive_option(self) -> None:
        Modifier.objects.filter(pk=self.cheese.pk).update(active=False)

        self._assert_rejected(
            [self.medium.id, self.cheese.id], 'Hay opciones que no están disponibles para Hamburguesa.'
        )

    def test_inactive_group_is_not_offered_or_required(self) -> None:
        ModifierGroup.objects.filter(pk=self.doneness.pk).update(active=False)

        self._assert_rejected([self.medium.id], 'Hay opciones que no están disponibles para Hamburguesa.')
        self.assertEqual(self._order([]).status_code, status.HTTP_201_CREATED)

    def test_repeated_option(self) -> None:
        self._assert_rejected([self.medium.id, self.cheese.id, self.cheese.id], 'Hay opciones repetidas.')


class MenuTests(ModifierTestCase):
    def test_menu_shows_only_active_groups_and_options(self) -> None:
        Modifier.objects.filter(pk=self.egg.pk).update(active=False)
        sauces = ModifierGroup.objects.create(name='Salsas', active=False)
        self.burger.modifier_groups.add(sauces)

        response = self.client.get(f'{PRODUCTS_URL}{self.burger.id}/')

        groups = response.data['modifier_groups']
        self.assertEqual([group['name'] for group in groups], ['Término', 'Extras'])
        self.assertEqual([option['name'] for option in groups[1]['modifiers']], ['Queso', 'Tocineta'])
        self.assertEqual(groups[1]['modifiers'][0]['price_delta'], '3.00')
        self.assertEqual(
            sorted(response.data['modifier_group_ids']), sorted([self.doneness.id, self.extras.id, sauces.id])
        )

    def test_menu_does_not_query_per_product(self) -> None:
        def count_queries() -> int:
            with CaptureQueriesContext(connection) as queries:
                self.client.get(PRODUCTS_URL)
            return len(queries)

        before = count_queries()
        for index in range(3):
            extra = Product.objects.create(
                title=f'Plato {index}', image=make_image(), price='1.00', active=True
            )
            extra.modifier_groups.set([self.doneness, self.extras])

        self.assertEqual(count_queries(), before)

    def test_admin_assigns_groups_to_a_product(self) -> None:
        self.client.force_authenticate(self.admin)

        response = self.client.put(
            f'{PRODUCTS_URL}{self.juice.id}/labels/',
            {'modifier_group_ids': [self.extras.id]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['modifier_group_ids'], [self.extras.id])
        response = self.client.put(
            f'{PRODUCTS_URL}{self.juice.id}/labels/', {'modifier_group_ids': []}, format='json'
        )
        self.assertEqual(response.data['modifier_groups'], [])

    def test_assigning_groups_requires_staff_and_existing_groups(self) -> None:
        url = f'{PRODUCTS_URL}{self.juice.id}/labels/'
        self.client.force_authenticate(self.waiter)
        self.assertEqual(
            self.client.put(url, {'modifier_group_ids': []}, format='json').status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(self.admin)
        response = self.client.put(url, {'modifier_group_ids': [MISSING_ID]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ModifierGroupApiTests(ModifierTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.client.force_authenticate(self.admin)

    def test_creates_a_group_with_its_options(self) -> None:
        payload = {
            'name': 'Tamaño',
            'min_choices': 1,
            'max_choices': 1,
            'modifiers': [
                {'name': 'Pequeño', 'price_delta': '0', 'position': 0},
                {'name': 'Grande', 'price_delta': '4000', 'position': 1},
            ],
        }

        response = self.client.post(GROUPS_URL, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual([option['name'] for option in response.data['modifiers']], ['Pequeño', 'Grande'])
        self.assertEqual(ModifierGroup.objects.get(name='Tamaño').modifiers.count(), 2)

    def test_update_renames_adds_and_removes_options(self) -> None:
        payload = {
            'modifiers': [
                {'id': self.cheese.id, 'name': 'Queso extra', 'price_delta': '3.50'},
                {'name': 'Aguacate', 'price_delta': '2.00'},
            ]
        }

        response = self.client.patch(group_url(self.extras.id), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(
            list(self.extras.modifiers.order_by('id').values_list('name', 'price_delta')),
            [('Queso extra', Decimal('3.50')), ('Aguacate', Decimal('2.00'))],
        )
        self.assertEqual(len(response.data['modifiers']), 2)

    def test_lists_with_product_count_and_search(self) -> None:
        response = self.client.get(GROUPS_URL, {'search': 'tocineta'})

        self.assertEqual(
            [(group['name'], group['product_count']) for group in response.data], [('Extras', 1)]
        )

    def test_invalid_groups_are_rejected(self) -> None:
        cases = [
            ({'name': 'A', 'min_choices': 2, 'max_choices': 1}, 'max_choices'),
            ({'name': 'A', 'min_choices': 0, 'max_choices': 0}, 'max_choices'),
            ({'name': 'A', 'min_choices': 1, 'max_choices': 1}, 'min_choices'),
            (
                {'name': 'A', 'max_choices': 1, 'modifiers': [{'name': 'X', 'price_delta': '-1'}]},
                'modifiers',
            ),
        ]
        for payload, field in cases:
            with self.subTest(payload=payload):
                response = self.client.post(GROUPS_URL, payload, format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)

    def test_cannot_deactivate_the_options_a_required_group_needs(self) -> None:
        payload = {
            'modifiers': [
                {'id': self.medium.id, 'name': 'Medio', 'price_delta': '0', 'active': False},
                {'id': self.well_done.id, 'name': 'Bien cocida', 'price_delta': '0', 'active': False},
            ]
        }

        response = self.client.patch(group_url(self.doneness.id), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('min_choices', response.data)

    def test_options_of_another_group_cannot_be_edited(self) -> None:
        payload = {'modifiers': [{'id': self.medium.id, 'name': 'Robado', 'price_delta': '0'}]}

        response = self.client.patch(group_url(self.extras.id), payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Modifier.objects.get(pk=self.medium.pk).name, 'Medio')

    def test_permissions_and_missing_group(self) -> None:
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.post(GROUPS_URL, {}, format='json').status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get(GROUPS_URL).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.post(GROUPS_URL, {'name': 'X', 'max_choices': 1}, format='json').status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(group_url(MISSING_ID)).status_code, status.HTTP_404_NOT_FOUND)
