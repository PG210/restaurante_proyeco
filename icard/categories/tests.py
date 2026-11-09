from rest_framework import status

from categories.models import Category
from icard.testing import MediaTestCase, create_admin, create_member, make_image

CATEGORIES_URL = '/api/categories/'
MISSING_ID = 999999


def category_url(category_id: int) -> str:
    return f'{CATEGORIES_URL}{category_id}/'


class CategoryApiTests(MediaTestCase):
    def setUp(self) -> None:
        self.category = Category.objects.create(title='Postres', image=make_image())
        self.admin = create_admin()
        self.member = create_member()

    def test_anonymous_can_list_categories(self) -> None:
        response = self.client.get(CATEGORIES_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_anonymous_cannot_create_category(self) -> None:
        response = self.client.post(
            CATEGORIES_URL, {'title': 'Vinos', 'image': make_image()}, format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_staff_cannot_create_category(self) -> None:
        self.client.force_authenticate(self.member)
        response = self.client.post(
            CATEGORIES_URL, {'title': 'Vinos', 'image': make_image()}, format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Category.objects.filter(title='Vinos').exists())

    def test_non_staff_cannot_delete_category(self) -> None:
        self.client.force_authenticate(self.member)
        response = self.client.delete(category_url(self.category.id))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Category.objects.filter(id=self.category.id).exists())

    def test_staff_can_create_category(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            CATEGORIES_URL, {'title': 'Vinos', 'image': make_image()}, format='multipart'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Category.objects.filter(title='Vinos').exists())

    def test_staff_create_without_image_is_rejected(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.post(CATEGORIES_URL, {'title': 'Vinos'}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('image', response.data)

    def test_staff_can_rename_category(self) -> None:
        self.client.force_authenticate(self.admin)
        response = self.client.patch(category_url(self.category.id), {'title': 'Helados'}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.category.refresh_from_db()
        self.assertEqual(self.category.title, 'Helados')

    def test_missing_category_returns_404(self) -> None:
        response = self.client.get(category_url(MISSING_ID))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
