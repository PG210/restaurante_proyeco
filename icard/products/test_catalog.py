import datetime
import io
import os
from unittest import mock
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from PIL import Image
from rest_framework import status

from categories.models import Category
from icard.media import MAX_IMAGE_BYTES, MAX_IMAGE_SIDE
from icard.testing import MediaTestCase, create_admin, create_role_member, make_image, seed_roles
from orders.models import Order
from products.models import Product
from products.service_day import current_service_day
from tables.models import Table
from users.roles import KITCHEN_ROLE, WAITER_ROLE

BOGOTA = ZoneInfo('America/Bogota')
PRODUCTS_URL = '/api/products/'
CATEGORIES_URL = '/api/categories/'
RESTOCK_URL = f'{PRODUCTS_URL}restock/'
ORDERS_URL = '/api/orders/'
MISSING_ID = 999999
LARGE_SIDE = 3000
EXIF_ORIENTATION_TAG = 0x0112
EXIF_MAKE_TAG = 0x010F


def at_bogota(day: int, hour: int) -> datetime.datetime:
    return datetime.datetime(2026, 11, day, hour, tzinfo=BOGOTA)


def frozen_now(moment: datetime.datetime):
    return mock.patch('products.service_day.timezone.now', return_value=moment)


def availability_url(product_id: int) -> str:
    return f'{PRODUCTS_URL}{product_id}/availability/'


def jpeg_with_exif(side: int = LARGE_SIDE, name: str = 'foto.jpg') -> SimpleUploadedFile:
    exif = Image.Exif()
    exif[EXIF_MAKE_TAG] = 'Camara'
    exif[EXIF_ORIENTATION_TAG] = 1
    buffer = io.BytesIO()
    Image.new('RGB', (side, side // 2), 'red').save(buffer, format='JPEG', exif=exif)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/jpeg')


def oversized_png() -> SimpleUploadedFile:
    side = 1600
    noise = Image.frombytes('RGB', (side, side), os.urandom(side * side * 3))
    buffer = io.BytesIO()
    noise.save(buffer, format='PNG')
    assert buffer.tell() > MAX_IMAGE_BYTES
    return SimpleUploadedFile('ruido.png', buffer.getvalue(), content_type='image/png')


class ServiceDayTests(MediaTestCase):
    def test_late_night_still_belongs_to_the_previous_service_day(self) -> None:
        self.assertEqual(current_service_day(at_bogota(11, 2)), datetime.date(2026, 11, 10))

    def test_service_day_starts_at_five_in_the_morning(self) -> None:
        self.assertEqual(current_service_day(at_bogota(11, 5)), datetime.date(2026, 11, 11))

    @override_settings(BUSINESS_DAY_START_HOUR=0)
    def test_utc_midnight_does_not_change_the_day_in_bogota(self) -> None:
        self.assertEqual(current_service_day(at_bogota(10, 20)), datetime.date(2026, 11, 10))

    @override_settings(BUSINESS_DAY_START_HOUR=0)
    def test_start_hour_is_configurable(self) -> None:
        self.assertEqual(current_service_day(at_bogota(11, 2)), datetime.date(2026, 11, 11))


class AvailabilityTests(MediaTestCase):
    def setUp(self) -> None:
        seed_roles()
        self.category = Category.objects.create(title='Postres', image=make_image())
        self.product = Product.objects.create(
            title='Helado', image=make_image(), price='4.50', active=True, category=self.category
        )
        self.kitchen = create_role_member(KITCHEN_ROLE)
        self.waiter = create_role_member(WAITER_ROLE)

    def _mark_sold_out(self, product: Product | None = None):
        self.client.force_authenticate(self.kitchen)
        return self.client.patch(
            availability_url((product or self.product).id), {'is_available': False}, format='json'
        )

    def _public_product(self) -> dict:
        self.client.force_authenticate(None)
        return self.client.get(f'{PRODUCTS_URL}{self.product.id}/').data

    def test_kitchen_marks_a_product_sold_out_until_the_next_service_day(self) -> None:
        with frozen_now(at_bogota(10, 23)):
            response = self._mark_sold_out()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['is_available'])

        with frozen_now(at_bogota(11, 2)):
            self.assertFalse(self._public_product()['is_available'])
        with frozen_now(at_bogota(11, 5)):
            self.assertTrue(self._public_product()['is_available'])

    def test_kitchen_can_put_a_product_back(self) -> None:
        self._mark_sold_out()
        response = self.client.patch(availability_url(self.product.id), {'is_available': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_available'])

    def test_filter_by_availability(self) -> None:
        other = Product.objects.create(title='Flan', image=make_image(), price='3.00', active=True)
        self._mark_sold_out()
        self.client.force_authenticate(None)
        sold_out = self.client.get(PRODUCTS_URL, {'is_available': 'false'})
        available = self.client.get(PRODUCTS_URL, {'is_available': 'true'})
        self.assertEqual([item['id'] for item in sold_out.data], [self.product.id])
        self.assertEqual([item['id'] for item in available.data], [other.id])

    def test_restock_puts_back_only_products_sold_out_today(self) -> None:
        other = Product.objects.create(title='Flan', image=make_image(), price='3.00', active=True)
        yesterday = current_service_day() - datetime.timedelta(days=1)
        Product.objects.filter(pk=other.pk).update(sold_out_on=yesterday)
        self._mark_sold_out()

        response = self.client.post(RESTOCK_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'restocked': 1})
        self.product.refresh_from_db()
        self.assertIsNone(self.product.sold_out_on)

    def test_waiter_without_permission_gets_403(self) -> None:
        self.client.force_authenticate(self.waiter)
        response = self.client.patch(
            availability_url(self.product.id), {'is_available': False}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post(RESTOCK_URL).status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_gets_401(self) -> None:
        response = self.client.patch(
            availability_url(self.product.id), {'is_available': False}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_product_gets_404(self) -> None:
        self.client.force_authenticate(self.kitchen)
        response = self.client.patch(availability_url(MISSING_ID), {'is_available': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_value_gets_400(self) -> None:
        self.client.force_authenticate(self.kitchen)
        response = self.client.patch(
            availability_url(self.product.id), {'is_available': 'quizas'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.client.patch(availability_url(self.product.id), {}, format='json').status_code, 400
        )

    def test_kitchen_cannot_edit_the_price(self) -> None:
        self.client.force_authenticate(self.kitchen)
        response = self.client.patch(f'{PRODUCTS_URL}{self.product.id}/', {'price': '0.01'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class OrderableProductTests(MediaTestCase):
    def setUp(self) -> None:
        cache.clear()
        self.category = Category.objects.create(title='Postres', image=make_image())
        self.product = Product.objects.create(
            title='Helado', image=make_image(), price='4.50', active=True, category=self.category
        )
        self.table = Table.objects.create(number=5, is_open=True)
        self.admin = create_admin()

    def _staff_order(self):
        self.client.force_authenticate(self.admin)
        payload = {'table': self.table.id, 'product': self.product.id, 'quantity': 1}
        return self.client.post(ORDERS_URL, payload, format='json')

    def _guest_order(self):
        self.client.force_authenticate(None)
        payload = {'items': [{'product': self.product.id, 'quantity': 1, 'notes': ''}]}
        return self.client.post(f'/api/client/{self.table.token}/orders/', payload, format='json')

    def test_available_product_can_be_ordered(self) -> None:
        self.assertEqual(self._staff_order().status_code, status.HTTP_201_CREATED)

    def test_sold_out_product_cannot_be_ordered_by_staff_or_guest(self) -> None:
        Product.objects.filter(pk=self.product.pk).update(sold_out_on=current_service_day())
        self.assertEqual(self._staff_order().status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._guest_order().status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.exists())

    def test_product_of_a_hidden_category_cannot_be_ordered(self) -> None:
        Category.objects.filter(pk=self.category.pk).update(active=False)
        self.assertEqual(self._staff_order().status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._guest_order().status_code, status.HTTP_400_BAD_REQUEST)


class HiddenCategoryTests(MediaTestCase):
    def setUp(self) -> None:
        self.visible = Category.objects.create(title='Postres', image=make_image())
        self.hidden = Category.objects.create(title='Desayunos', image=make_image(), active=False)
        self.visible_product = Product.objects.create(
            title='Helado', image=make_image(), price='4.50', active=True, category=self.visible
        )
        self.hidden_product = Product.objects.create(
            title='Huevos', image=make_image(), price='6.00', active=True, category=self.hidden
        )
        self.admin = create_admin()

    def test_menu_does_not_show_hidden_categories_or_their_products(self) -> None:
        categories = self.client.get(CATEGORIES_URL)
        products = self.client.get(PRODUCTS_URL, {'active': True})
        self.assertEqual([item['id'] for item in categories.data], [self.visible.id])
        self.assertEqual([item['id'] for item in products.data], [self.visible_product.id])
        hidden_detail = self.client.get(f'{PRODUCTS_URL}{self.hidden_product.id}/')
        self.assertEqual(hidden_detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_staff_still_sees_hidden_categories(self) -> None:
        self.client.force_authenticate(self.admin)
        categories = self.client.get(CATEGORIES_URL)
        products = self.client.get(PRODUCTS_URL)
        self.assertEqual(len(categories.data), 2)
        self.assertEqual(len(products.data), 2)

    def test_staff_can_hide_a_category(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.patch(f'{CATEGORIES_URL}{self.visible.id}/', {'active': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['active'])


class CatalogOrderTests(MediaTestCase):
    def test_categories_and_products_follow_position_then_title(self) -> None:
        drinks = Category.objects.create(title='Bebidas', image=make_image(), position=2)
        desserts = Category.objects.create(title='Postres', image=make_image(), position=1)
        starters = Category.objects.create(title='Entradas', image=make_image(), position=1)
        late = Product.objects.create(title='Agua', image=make_image(), price='1.00', position=5)
        first = Product.objects.create(title='Zumo', image=make_image(), price='2.00', position=0)
        second = Product.objects.create(title='Café', image=make_image(), price='2.00', position=0)

        categories = self.client.get(CATEGORIES_URL).data
        products = self.client.get(PRODUCTS_URL).data

        self.assertEqual([item['id'] for item in categories], [starters.id, desserts.id, drinks.id])
        self.assertEqual([item['id'] for item in products], [second.id, first.id, late.id])

    def test_staff_saves_description_and_position(self) -> None:
        self.client.force_authenticate(create_admin())
        payload = {
            'title': 'Tiramisú',
            'description': 'Con café y mascarpone',
            'price': '5.75',
            'position': 3,
            'image': make_image(),
        }
        response = self.client.post(PRODUCTS_URL, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['description'], 'Con café y mascarpone')
        self.assertEqual(response.data['position'], 3)

    def test_negative_position_is_rejected(self) -> None:
        self.client.force_authenticate(create_admin())
        payload = {'title': 'Vinos', 'image': make_image(), 'position': -1}
        response = self.client.post(CATEGORIES_URL, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('position', response.data)


class ImageUploadTests(MediaTestCase):
    def setUp(self) -> None:
        self.client.force_authenticate(create_admin())

    def _create_product(self, image) -> 'Product':
        payload = {'title': 'Bandeja', 'price': '30000.00', 'image': image}
        response = self.client.post(PRODUCTS_URL, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return Product.objects.get(pk=response.data['id'])

    def test_large_photo_is_resized_and_stripped_of_exif(self) -> None:
        product = self._create_product(jpeg_with_exif())
        with Image.open(product.image.path) as stored:
            self.assertEqual(max(stored.size), MAX_IMAGE_SIDE)
            self.assertFalse(stored.getexif())

    def test_image_over_five_megabytes_is_rejected(self) -> None:
        payload = {'title': 'Bandeja', 'price': '1.00', 'image': oversized_png()}
        response = self.client.post(PRODUCTS_URL, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('image', response.data)

    def test_file_that_is_not_an_image_is_rejected(self) -> None:
        fake = SimpleUploadedFile('menu.png', b'no soy una imagen', content_type='image/png')
        response = self.client.post(CATEGORIES_URL, {'title': 'Vinos', 'image': fake}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('image', response.data)

    def test_replacing_the_image_deletes_the_previous_file(self) -> None:
        product = self._create_product(make_image())
        previous_name = product.image.name
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                f'{PRODUCTS_URL}{product.id}/', {'image': make_image('nueva.png')}, format='multipart'
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(default_storage.exists(previous_name))
        product.refresh_from_db()
        self.assertTrue(default_storage.exists(product.image.name))

    def test_updating_other_fields_keeps_the_image(self) -> None:
        product = self._create_product(make_image())
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(f'{PRODUCTS_URL}{product.id}/', {'title': 'Otro'}, format='multipart')
        self.assertTrue(default_storage.exists(product.image.name))

    def test_deleting_a_category_deletes_its_image(self) -> None:
        category = Category.objects.create(title='Vinos', image=make_image())
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(f'{CATEGORIES_URL}{category.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(default_storage.exists(category.image.name))


class UploadCommandTests(MediaTestCase):
    def _run(self, command: str, *args: str) -> str:
        output = io.StringIO()
        call_command(command, *args, stdout=output, stderr=io.StringIO())
        return output.getvalue()

    def test_delete_orphan_uploads(self) -> None:
        product = Product.objects.create(title='Helado', image=make_image(), price='1.00')
        orphan = default_storage.save('products/huerfana.png', make_image())

        dry_run_output = self._run('delete_orphan_uploads', '--dry-run')
        self.assertIn(orphan, dry_run_output)
        self.assertTrue(default_storage.exists(orphan))

        self._run('delete_orphan_uploads')
        self.assertFalse(default_storage.exists(orphan))
        self.assertTrue(default_storage.exists(product.image.name))

    def test_optimize_uploads(self) -> None:
        large = Product.objects.create(title='Bandeja', image=jpeg_with_exif(), price='1.00')
        small = Category.objects.create(title='Postres', image=make_image())
        small_bytes = default_storage.size(small.image.name)

        dry_run_output = self._run('optimize_uploads', '--dry-run')
        self.assertIn(large.image.name, dry_run_output)
        self.assertNotIn(small.image.name, dry_run_output)
        with Image.open(large.image.path) as untouched:
            self.assertEqual(max(untouched.size), LARGE_SIDE)

        self._run('optimize_uploads')
        with Image.open(large.image.path) as optimized:
            self.assertEqual(max(optimized.size), MAX_IMAGE_SIDE)
            self.assertFalse(optimized.getexif())
        self.assertEqual(default_storage.size(small.image.name), small_bytes)
