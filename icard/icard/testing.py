import io
import shutil
import tempfile

from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from users.models import User

TEST_PASSWORD = 'Test-pass-123'
TEST_IMAGE_SIZE = (2, 2)


def create_admin(username: str = 'admin') -> User:
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password=TEST_PASSWORD, is_staff=True
    )


def create_member(username: str = 'member') -> User:
    return User.objects.create_user(
        username=username, email=f'{username}@example.com', password=TEST_PASSWORD
    )


def seed_roles() -> None:
    call_command('seed_roles', stdout=io.StringIO())


def create_role_member(role: str) -> User:
    user = create_member(role)
    user.groups.add(Group.objects.get(name=role))
    return user


def make_image(name: str = 'test.png') -> SimpleUploadedFile:
    buffer = io.BytesIO()
    Image.new('RGB', TEST_IMAGE_SIZE).save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


class MediaTestCase(APITestCase):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        cls._media_root = tempfile.mkdtemp()
        cls._media_override = override_settings(MEDIA_ROOT=cls._media_root)
        cls._media_override.enable()

    @classmethod
    def tearDownClass(cls) -> None:
        cls._media_override.disable()
        shutil.rmtree(cls._media_root, ignore_errors=True)
        super().tearDownClass()
