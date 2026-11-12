from importlib import import_module

from django.apps import apps
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status

from categories.models import Category
from configuration.business_day import business_day_start_hour
from icard.testing import MediaTestCase, create_admin, create_role_member, make_image, seed_roles
from orders.models import Order
from products.models import Allergen, Product, Tag
from tables.models import Table
from users.roles import WAITER_ROLE

PRODUCTS_URL = '/api/products/'
ALLERGENS_URL = '/api/allergens/'
TAGS_URL = '/api/tags/'
ORDERS_URL = '/api/orders/'
MISSING_ID = 999999
SEED_MIGRATION = import_module('products.migrations.0006_seed_allergens_and_tags')


def labels_url(product: Product) -> str:
    return f'{PRODUCTS_URL}{product.id}/labels/'


class LabelTestCase(MediaTestCase):
    def setUp(self) -> None:
        cache.clear()
        seed_roles()
        self.category = Category.objects.create(title='Platos', image=make_image())
        self.burger = Product.objects.create(
            title='Hamburguesa', image=make_image(), price='20.00', active=True, category=self.category
        )
        self.salad = Product.objects.create(
            title='Ensalada', image=make_image(), price='12.00', active=True, category=self.category
        )
        self.gluten = Allergen.objects.get(name='Gluten')
        self.dairy = Allergen.objects.get(name='Lácteos')
        self.vegan = Tag.objects.get(name='Vegano')
        self.spicy = Tag.objects.get(name='Picante')
        self.admin = create_admin()
        self.waiter = create_role_member(WAITER_ROLE)

    def _assign(self, product: Product, payload: dict):
        self.client.force_authenticate(self.admin)
        return self.client.put(labels_url(product), payload, format='json')


class SeedTests(LabelTestCase):
    def test_migration_loads_the_reference_allergens_and_tags(self) -> None:
        self.assertEqual(Allergen.objects.count(), len(SEED_MIGRATION.ALLERGENS))
        self.assertEqual(Tag.objects.count(), len(SEED_MIGRATION.TAGS))
        self.assertTrue(Tag.objects.filter(name='Sin gluten').exists())

    def test_seeding_again_does_not_duplicate(self) -> None:
        Allergen.objects.filter(pk=self.gluten.pk).update(name='GLUTEN')

        SEED_MIGRATION.seed(apps, None)

        self.assertEqual(Allergen.objects.count(), len(SEED_MIGRATION.ALLERGENS))


class AssignLabelsTests(LabelTestCase):
    def test_assigned_labels_are_shown_in_the_menu(self) -> None:
        response = self._assign(
            self.burger, {'allergen_ids': [self.gluten.id, self.dairy.id], 'tag_ids': [self.spicy.id]}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(None)
        data = self.client.get(f'{PRODUCTS_URL}{self.burger.id}/').data

        self.assertEqual([allergen['name'] for allergen in data['allergens']], ['Gluten', 'Lácteos'])
        self.assertEqual(data['tags'], [{'id': self.spicy.id, 'name': 'Picante'}])
        self.assertTrue(data['allergens_declared'])

    def test_a_new_product_is_not_reviewed(self) -> None:
        self.client.force_authenticate(None)
        data = self.client.get(f'{PRODUCTS_URL}{self.salad.id}/').data

        self.assertFalse(data['allergens_declared'])
        self.assertEqual(data['allergens'], [])

    def test_saving_an_empty_allergen_list_reviews_the_product(self) -> None:
        response = self._assign(self.salad, {'allergen_ids': [], 'tag_ids': [self.vegan.id]})

        self.assertTrue(response.data['allergens_declared'])
        self.assertEqual(response.data['allergens'], [])

    def test_saving_only_tags_does_not_review_the_allergens(self) -> None:
        response = self._assign(self.salad, {'tag_ids': [self.vegan.id]})

        self.assertFalse(response.data['allergens_declared'])

    def test_a_product_with_allergens_stays_reviewed(self) -> None:
        self._assign(self.burger, {'allergen_ids': [self.gluten.id]})

        response = self._assign(self.burger, {'allergens_declared': False})

        self.assertTrue(response.data['allergens_declared'])

    def test_review_can_be_undone_when_there_are_no_allergens(self) -> None:
        self._assign(self.salad, {'allergen_ids': []})

        response = self._assign(self.salad, {'allergen_ids': [], 'allergens_declared': False})

        self.assertFalse(response.data['allergens_declared'])

    def test_inactive_labels_are_hidden_but_kept_on_the_product(self) -> None:
        self._assign(self.burger, {'allergen_ids': [self.gluten.id, self.dairy.id]})
        Allergen.objects.filter(pk=self.dairy.pk).update(active=False)

        response = self._assign(self.burger, {'allergen_ids': [self.gluten.id]})

        self.assertEqual(response.data['allergen_ids'], [self.gluten.id])
        Allergen.objects.filter(pk=self.dairy.pk).update(active=True)
        self.burger.refresh_from_db()
        self.assertEqual(set(self.burger.allergens.all()), {self.gluten, self.dairy})

    def test_inactive_or_missing_labels_cannot_be_assigned(self) -> None:
        Tag.objects.filter(pk=self.spicy.pk).update(active=False)

        for payload in ({'tag_ids': [self.spicy.id]}, {'allergen_ids': [MISSING_ID]}):
            with self.subTest(payload=payload):
                response = self._assign(self.burger, payload)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_product_form_cannot_change_the_review_flag(self) -> None:
        self.client.force_authenticate(self.admin)

        self.client.patch(f'{PRODUCTS_URL}{self.salad.id}/', {'allergens_declared': True}, format='json')

        self.salad.refresh_from_db()
        self.assertFalse(self.salad.allergens_declared)

    def test_filters_products_pending_review(self) -> None:
        self._assign(self.burger, {'allergen_ids': [self.gluten.id]})
        self.client.force_authenticate(self.admin)

        response = self.client.get(PRODUCTS_URL, {'allergens_declared': 'false'})

        self.assertEqual([product['title'] for product in response.data], ['Ensalada'])

    def test_assigning_requires_admin_and_an_existing_product(self) -> None:
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.put(labels_url(self.burger), {}, format='json').status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.client.force_authenticate(self.waiter)
        self.assertEqual(
            self.client.put(labels_url(self.burger), {}, format='json').status_code, status.HTTP_403_FORBIDDEN
        )
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.put(f'{PRODUCTS_URL}{MISSING_ID}/labels/', {}, format='json').status_code,
            status.HTTP_404_NOT_FOUND,
        )


class QueryCountTests(LabelTestCase):
    def setUp(self) -> None:
        super().setUp()
        business_day_start_hour()  # cached once, as in production, so it does not skew the counts

    def _count_queries(self, url: str) -> int:
        with CaptureQueriesContext(connection) as queries:
            self.client.get(url)
        return len(queries)

    def _add_labelled_products(self) -> list[Product]:
        products = []
        for index in range(3):
            product = Product.objects.create(
                title=f'Plato {index}', image=make_image(), price='1.00', active=True, category=self.category
            )
            product.allergens.set([self.gluten, self.dairy])
            product.tags.set([self.vegan])
            products.append(product)
        return products

    def test_menu_does_not_query_per_product(self) -> None:
        before = self._count_queries(PRODUCTS_URL)
        self._add_labelled_products()

        self.assertEqual(self._count_queries(PRODUCTS_URL), before)

    def test_order_list_does_not_query_per_order(self) -> None:
        table = Table.objects.create(number=1, is_open=True)
        self.client.force_authenticate(self.admin)
        Order.objects.create(table=table, product=self.burger, price='20.00')
        before = self._count_queries(ORDERS_URL)

        for product in self._add_labelled_products():
            Order.objects.create(table=table, product=product, price='1.00')

        self.assertEqual(self._count_queries(ORDERS_URL), before)


class LabelApiTests(LabelTestCase):
    def test_public_list_shows_only_active_labels(self) -> None:
        Allergen.objects.filter(pk=self.dairy.pk).update(active=False)

        response = self.client.get(ALLERGENS_URL)

        names = [allergen['name'] for allergen in response.data]
        self.assertIn('Gluten', names)
        self.assertNotIn('Lácteos', names)

    def test_admin_list_has_every_label_with_its_product_count(self) -> None:
        self._assign(self.burger, {'tag_ids': [self.spicy.id]})
        Tag.objects.filter(pk=self.vegan.pk).update(active=False)

        response = self.client.get(TAGS_URL)

        counts = {tag['name']: tag['product_count'] for tag in response.data}
        self.assertEqual(counts['Picante'], 1)
        self.assertEqual(counts['Vegano'], 0)

    def test_admin_creates_renames_and_deletes(self) -> None:
        self.client.force_authenticate(self.admin)

        created = self.client.post(TAGS_URL, {'name': '  Nuevo  ', 'position': 9}, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data['name'], 'Nuevo')

        url = f'{TAGS_URL}{created.data["id"]}/'
        self.assertEqual(
            self.client.patch(url, {'name': 'De temporada'}, format='json').data['name'], 'De temporada'
        )
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_204_NO_CONTENT)

    def test_deleting_an_allergen_removes_it_from_the_products(self) -> None:
        self._assign(self.burger, {'allergen_ids': [self.gluten.id]})

        self.client.delete(f'{ALLERGENS_URL}{self.gluten.id}/')

        self.assertFalse(self.burger.allergens.exists())

    def test_names_must_be_unique_and_not_blank(self) -> None:
        self.client.force_authenticate(self.admin)

        for name, message in (('gluten', 'Ya existe un alérgeno con ese nombre.'), ('   ', None)):
            with self.subTest(name=name):
                response = self.client.post(ALLERGENS_URL, {'name': name}, format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                if message:
                    self.assertEqual(response.data['name'], [message])

    def test_keeping_its_own_name_is_not_a_duplicate(self) -> None:
        self.client.force_authenticate(self.admin)

        response = self.client.patch(f'{ALLERGENS_URL}{self.gluten.id}/', {'name': 'Gluten', 'position': 3})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_only_the_admin_manages_labels(self) -> None:
        url = f'{ALLERGENS_URL}{self.gluten.id}/'
        self.assertEqual(
            self.client.post(ALLERGENS_URL, {'name': 'Kiwi'}).status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.delete(f'{ALLERGENS_URL}{MISSING_ID}/').status_code, status.HTTP_404_NOT_FOUND
        )
