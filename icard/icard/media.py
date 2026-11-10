import io
import logging
from pathlib import PurePath

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models.fields.files import FieldFile
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_SIDE = 1200
JPEG_QUALITY = 85
JPEG_FORMAT = 'JPEG'
PNG_FORMAT = 'PNG'
ALLOWED_FORMATS = (JPEG_FORMAT, PNG_FORMAT)
JPEG_MODES = ('RGB', 'L')

IMAGE_TOO_LARGE_MESSAGE = 'La imagen no puede superar 5 MB.'
INVALID_IMAGE_MESSAGE = 'Sube una imagen JPEG o PNG válida.'


class InvalidImageError(ValueError):
    pass


def needs_optimization(image: Image.Image) -> bool:
    return max(image.size) > MAX_IMAGE_SIDE or bool(image.getexif())


def optimize_image(uploaded_file) -> ContentFile:
    if uploaded_file.size > MAX_IMAGE_BYTES:
        raise InvalidImageError(IMAGE_TOO_LARGE_MESSAGE)
    uploaded_file.seek(0)
    image = open_image(uploaded_file)
    return ContentFile(encode_optimized(image), name=PurePath(uploaded_file.name).name)


def open_image(source) -> Image.Image:
    try:
        image = Image.open(source)
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise InvalidImageError(INVALID_IMAGE_MESSAGE) from error
    if image.format not in ALLOWED_FORMATS:
        raise InvalidImageError(INVALID_IMAGE_MESSAGE)
    return image


def encode_optimized(image: Image.Image) -> bytes:
    image_format = image.format
    resized = ImageOps.exif_transpose(image)
    resized.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
    buffer = io.BytesIO()
    if image_format == JPEG_FORMAT:
        rgb_image = resized if resized.mode in JPEG_MODES else resized.convert('RGB')
        rgb_image.save(buffer, format=JPEG_FORMAT, quality=JPEG_QUALITY, optimize=True)
    else:
        resized.save(buffer, format=PNG_FORMAT, optimize=True)
    return buffer.getvalue()


def delete_file_on_commit(field_file: FieldFile) -> None:
    storage, name = field_file.storage, field_file.name
    if name:
        transaction.on_commit(lambda: _delete_file(storage, name))


def _delete_file(storage, name: str) -> None:
    try:
        storage.delete(name)
    except OSError:
        logger.warning('No se pudo borrar el archivo %s', name, exc_info=True)


class ImageCleanupMixin:
    image_field = 'image'

    def perform_update(self, serializer) -> None:
        previous_file = getattr(serializer.instance, self.image_field)
        storage, previous_name = previous_file.storage, previous_file.name
        with transaction.atomic():
            instance = self.save_update(serializer)
            if previous_name and getattr(instance, self.image_field).name != previous_name:
                transaction.on_commit(lambda: _delete_file(storage, previous_name))

    def save_update(self, serializer):
        return serializer.save()

    def perform_destroy(self, instance) -> None:
        with transaction.atomic():
            delete_file_on_commit(getattr(instance, self.image_field))
            instance.delete()
