from dataclasses import dataclass

from django.core.files.storage import default_storage

from categories.models import Category
from icard.media import encode_optimized, needs_optimization, open_image
from products.models import Product

IMAGE_MODELS = (Product, Category)
UPLOAD_DIRECTORIES = ('products', 'categories')


@dataclass(frozen=True)
class OptimizationResult:
    name: str
    bytes_before: int
    bytes_after: int


def referenced_upload_names() -> set[str]:
    names: set[str] = set()
    for model in IMAGE_MODELS:
        names.update(model.objects.exclude(image='').values_list('image', flat=True))
    return names


def orphan_upload_names() -> list[str]:
    referenced = referenced_upload_names()
    stored = [f'{directory}/{name}' for directory in UPLOAD_DIRECTORIES for name in _stored_files(directory)]
    return sorted(name for name in stored if name not in referenced)


def _stored_files(directory: str) -> list[str]:
    try:
        _, files = default_storage.listdir(directory)
    except FileNotFoundError:
        return []
    return files


def needs_upload_optimization(name: str) -> bool:
    with default_storage.open(name, 'rb') as stored_file:
        return needs_optimization(open_image(stored_file))


def optimize_upload(name: str) -> OptimizationResult:
    bytes_before = default_storage.size(name)
    with default_storage.open(name, 'rb') as stored_file:
        optimized = encode_optimized(open_image(stored_file))
    with default_storage.open(name, 'wb') as stored_file:
        stored_file.write(optimized)
    return OptimizationResult(name=name, bytes_before=bytes_before, bytes_after=len(optimized))
