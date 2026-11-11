from collections import Counter
from decimal import Decimal

from django.db.models import Prefetch, QuerySet

from products.models import Modifier, ModifierGroup, Product

MAX_MODIFIERS_PER_ITEM = 20


class ModifierSelectionError(Exception):
    pass


def modifier_groups_prefetch(lookup: str = 'modifier_groups') -> Prefetch:
    return Prefetch(lookup, queryset=ModifierGroup.objects.prefetch_related('modifiers'))


def with_modifier_groups(queryset: QuerySet) -> QuerySet:
    return queryset.prefetch_related(modifier_groups_prefetch())


def offered_groups(product: Product) -> list[ModifierGroup]:
    return [group for group in product.modifier_groups.all() if group.active]


def offered_modifiers(group: ModifierGroup) -> list[Modifier]:
    return [modifier for modifier in group.modifiers.all() if modifier.active]


def choices_message(group: ModifierGroup) -> str:
    if group.min_choices == group.max_choices:
        noun = 'opción' if group.min_choices == 1 else 'opciones'
        return f'Elige {group.min_choices} {noun} en {group.name}.'
    if group.min_choices == 0:
        return f'Elige como máximo {group.max_choices} en {group.name}.'
    return f'Elige entre {group.min_choices} y {group.max_choices} opciones en {group.name}.'


def resolve_modifiers(product: Product, modifier_ids: list[int]) -> tuple[Modifier, ...]:
    if len(set(modifier_ids)) != len(modifier_ids):
        raise ModifierSelectionError('Hay opciones repetidas.')
    groups = offered_groups(product)
    offered = {modifier.pk: modifier for group in groups for modifier in offered_modifiers(group)}
    unknown = [modifier_id for modifier_id in modifier_ids if modifier_id not in offered]
    if unknown:
        raise ModifierSelectionError(f'Hay opciones que no están disponibles para {product.title}.')
    chosen = [offered[modifier_id] for modifier_id in modifier_ids]
    counts = Counter(modifier.group_id for modifier in chosen)
    for group in groups:
        if not group.min_choices <= counts[group.pk] <= group.max_choices:
            raise ModifierSelectionError(choices_message(group))
    group_order = {group.pk: index for index, group in enumerate(groups)}
    return tuple(sorted(chosen, key=lambda modifier: (group_order[modifier.group_id], modifier.position)))


def unit_price(product: Product, modifiers: tuple[Modifier, ...]) -> Decimal:
    return Decimal(str(product.price)) + sum(
        (Decimal(str(modifier.price_delta)) for modifier in modifiers), Decimal('0')
    )


def sync_modifiers(group: ModifierGroup, options: list[dict]) -> None:
    existing = {modifier.pk: modifier for modifier in group.modifiers.all()}
    kept_ids = set()
    for option in options:
        fields = {key: value for key, value in option.items() if key != 'id'}
        modifier = existing.get(option.get('id'))
        if modifier is None:
            Modifier.objects.create(group=group, **fields)
            continue
        for field, value in fields.items():
            setattr(modifier, field, value)
        modifier.save()
        kept_ids.add(modifier.pk)
    group.modifiers.filter(pk__in=set(existing) - kept_ids).delete()
