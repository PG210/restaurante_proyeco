from collections.abc import Iterable

from django.db import transaction
from django.db.models import Prefetch, QuerySet

from products.models import Allergen, ModifierGroup, Product, ProductLabel, Tag
from products.modifiers import modifier_groups_prefetch


def product_prefetches(prefix: str = '') -> list[Prefetch | str]:
    return [modifier_groups_prefetch(f'{prefix}modifier_groups'), f'{prefix}allergens', f'{prefix}tags']


def with_product_relations(queryset: QuerySet) -> QuerySet:
    return queryset.prefetch_related(*product_prefetches())


def active_labels(labels: Iterable[ProductLabel]) -> list[ProductLabel]:
    return [label for label in labels if label.active]


def _keep_inactive(current: Iterable[ProductLabel], chosen: list[ProductLabel]) -> list[ProductLabel]:
    return [*chosen, *(label for label in current if not label.active)]


def set_product_labels(
    product: Product,
    *,
    modifier_groups: list[ModifierGroup] | None = None,
    allergens: list[Allergen] | None = None,
    tags: list[Tag] | None = None,
    allergens_declared: bool | None = None,
) -> Product:
    """Replace only the relations that were sent. Inactive labels stay on the product, hidden."""
    with transaction.atomic():
        if modifier_groups is not None:
            product.modifier_groups.set(modifier_groups)
        if allergens is not None:
            product.allergens.set(_keep_inactive(product.allergens.all(), allergens))
        if tags is not None:
            product.tags.set(_keep_inactive(product.tags.all(), tags))
        declared = _declared(product, allergens, allergens_declared)
        if declared != product.allergens_declared:
            product.allergens_declared = declared
            product.save(update_fields=['allergens_declared'])
    return product


def _declared(product: Product, allergens: list[Allergen] | None, requested: bool | None) -> bool:
    """Saving the allergens reviews them, even an empty list; a product with allergens is always reviewed."""
    if product.allergens.filter(active=True).exists():
        return True
    if requested is not None:
        return requested
    return True if allergens is not None else product.allergens_declared
