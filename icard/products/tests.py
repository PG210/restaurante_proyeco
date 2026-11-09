from rest_framework import status

from categories.models import Category
from icard.testing import MediaTestCase, create_admin, create_member, make_image
from products.models import Product

PRODUCTS_URL = '/api/products/'
MISSING_ID = 999999


def product_url(product_id: int) -> str:
    return f'{PRODUCTS_URL}{product_id}/'


class ProductApiTests(MediaTestCase):
    def setUp(self) -> None:
        self.category = Category.objects.create(title='Postres', image=make_image())
        self.active_product = Product.objects.create(
            title='Helado', image=make_image(), price='4.50', active=True, category=self.category
        )
        self.inactive_product = Product.objects.create(title='Flan', image=make_image(), price='3.00')
        self.admin = create_admin()
        self.member = create_member()

    def _payload(self) -> dict:
        return {
            'title': 'Tiramisú',
            'price': '5.75',
            'active': True,
            'category': self.category.id,
            'image': make_image(),
        }

    def test_anonymous_can_filter_active_products_by_category(self) -> None:
        response = self.client.get(PRODUCTS_URL, {'category': self.category.id, 'active': True})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['id'] for item in response.data], [self.active_product.id])
        self.assertEqual(response.data[0]['category_data']['title'], 'Postres')

    def test_product_without_category_is_listed_with_null_category(self) -> None:
        response = self.client.get(product_url(self.inactive_product.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['category_data'])

    def test_anonymous_cannot_create_product(self) -> None:
        response = self.client.post(PRODUCTS_URL, self._payload(), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_staff_cannot_update_product(self) -> None:
        self.client.force_authenticate(self.member)
        response = self.client.patch(
            product_url(self.active_product.id), {'price': '0.01'}, format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.active_product.refresh_from_db()
        self.assertEqual(str(self.active_product.price), '4.50')

    def test_staff_can_create_product_with_decimal_price(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.post(PRODUCTS_URL, self._payload(), format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['price'], '5.75')

    def test_staff_create_with_invalid_price_is_rejected(self) -> None:
        self.client.force_authenticate(self.admin)
        payload = {**self._payload(), 'price': 'gratis'}
        response = self.client.post(PRODUCTS_URL, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('price', response.data)

    def test_staff_can_delete_product(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.delete(product_url(self.active_product.id))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Product.objects.filter(id=self.active_product.id).exists())

    def test_missing_product_returns_404(self) -> None:
        response = self.client.get(product_url(MISSING_ID))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
