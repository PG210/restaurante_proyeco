from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from categories.api.serializers import CategorySerializer
from icard.serializers import OptimizedImageMixin
from products.labels import active_labels
from products.models import (
    MIN_MAX_CHOICES,
    STOCK_NOTE_MAX_LENGTH,
    Allergen,
    Modifier,
    ModifierGroup,
    Product,
    StockMovement,
    Tag,
)
from products.modifiers import offered_groups, offered_modifiers, sync_modifiers

STOCK_FIELDS = ('stock', 'low_stock_threshold', 'low_stock', 'sold_today')
MIN_RESTOCK_UNITS = 1


class OfferedModifierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modifier
        fields = ['id', 'name', 'price_delta']
        read_only_fields = fields


class OfferedModifierGroupSerializer(serializers.ModelSerializer):
    modifiers = serializers.SerializerMethodField()

    class Meta:
        model = ModifierGroup
        fields = ['id', 'name', 'min_choices', 'max_choices', 'modifiers']
        read_only_fields = fields

    def get_modifiers(self, group: ModifierGroup) -> list[dict]:
        return OfferedModifierSerializer(offered_modifiers(group), many=True).data


class OfferedLabelSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)


class ProductSerializer(OptimizedImageMixin, serializers.ModelSerializer):
    category_data = CategorySerializer(source='category', read_only=True)
    is_available = serializers.BooleanField(read_only=True)
    sold_out_today = serializers.BooleanField(source='is_sold_out_today', read_only=True)
    low_stock = serializers.BooleanField(source='is_low_stock', read_only=True)
    sold_today = serializers.SerializerMethodField()
    modifier_groups = serializers.SerializerMethodField()
    modifier_group_ids = serializers.SerializerMethodField()
    allergens = serializers.SerializerMethodField()
    allergen_ids = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    tag_ids = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'title',
            'description',
            'image',
            'price',
            'active',
            'is_available',
            'sold_out_today',
            'position',
            'category',
            'category_data',
            'modifier_groups',
            'modifier_group_ids',
            'allergens',
            'allergen_ids',
            'allergens_declared',
            'tags',
            'tag_ids',
            'preparation_time',
            *STOCK_FIELDS,
        ]
        read_only_fields = ['allergens_declared']

    def get_modifier_groups(self, product: Product) -> list[dict]:
        return OfferedModifierGroupSerializer(offered_groups(product), many=True).data

    def get_modifier_group_ids(self, product: Product) -> list[int]:
        return [group.pk for group in product.modifier_groups.all()]

    def get_allergens(self, product: Product) -> list[dict]:
        return OfferedLabelSerializer(active_labels(product.allergens.all()), many=True).data

    def get_allergen_ids(self, product: Product) -> list[int]:
        return [allergen.pk for allergen in active_labels(product.allergens.all())]

    def get_tags(self, product: Product) -> list[dict]:
        return OfferedLabelSerializer(active_labels(product.tags.all()), many=True).data

    def get_tag_ids(self, product: Product) -> list[int]:
        return [tag.pk for tag in active_labels(product.tags.all())]

    def get_sold_today(self, product: Product) -> int | None:
        if not product.tracks_stock:
            return None
        return -getattr(product, 'sales_change_today', 0)

    def to_representation(self, instance: Product) -> dict:
        data = super().to_representation(instance)
        if not self.context.get('show_stock'):
            for field in STOCK_FIELDS:
                data.pop(field, None)
        return data


class ProductAvailabilitySerializer(serializers.Serializer):
    is_available = serializers.BooleanField()


class RestockResultSerializer(serializers.Serializer):
    restocked = serializers.IntegerField()


class AddStockSerializer(serializers.Serializer):
    units = serializers.IntegerField(min_value=MIN_RESTOCK_UNITS)


class SetStockSerializer(serializers.Serializer):
    units = serializers.IntegerField(min_value=0)
    note = serializers.CharField(max_length=STOCK_NOTE_MAX_LENGTH, allow_blank=False)


class StockMovementSerializer(serializers.ModelSerializer):
    reason_label = serializers.CharField(source='get_reason_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StockMovement
        fields = [
            'id',
            'change',
            'stock_after',
            'reason',
            'reason_label',
            'order',
            'note',
            'service_day',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = fields

    def get_created_by_name(self, movement: StockMovement) -> str:
        user = movement.created_by
        if user is None:
            return 'Cliente (QR)' if movement.order_id else ''
        return user.get_full_name() or user.email


class ProductLabelsSerializer(serializers.Serializer):
    modifier_group_ids = serializers.PrimaryKeyRelatedField(
        queryset=ModifierGroup.objects.all(), many=True, allow_empty=True, required=False
    )
    allergen_ids = serializers.PrimaryKeyRelatedField(
        queryset=Allergen.objects.filter(active=True), many=True, allow_empty=True, required=False
    )
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.filter(active=True), many=True, allow_empty=True, required=False
    )
    allergens_declared = serializers.BooleanField(required=False)


class LabelSerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, default=0)
    duplicate_message = ''

    class Meta:
        fields = ['id', 'name', 'active', 'position', 'product_count']

    def validate_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError('El nombre es obligatorio.')
        duplicates = self.Meta.model.objects.filter(name__iexact=name)
        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError(self.duplicate_message)
        return name


class AllergenSerializer(LabelSerializer):
    duplicate_message = 'Ya existe un alérgeno con ese nombre.'

    class Meta(LabelSerializer.Meta):
        model = Allergen


class TagSerializer(LabelSerializer):
    duplicate_message = 'Ya existe una etiqueta con ese nombre.'

    class Meta(LabelSerializer.Meta):
        model = Tag


class ModifierWriteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False, min_value=1)
    price_delta = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0'))

    class Meta:
        model = Modifier
        fields = ['id', 'name', 'price_delta', 'active', 'position']


class ModifierGroupSerializer(serializers.ModelSerializer):
    max_choices = serializers.IntegerField(min_value=MIN_MAX_CHOICES)
    modifiers = ModifierWriteSerializer(many=True, required=False)
    product_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ModifierGroup
        fields = [
            'id',
            'name',
            'min_choices',
            'max_choices',
            'active',
            'position',
            'modifiers',
            'product_count',
        ]

    def validate(self, attrs: dict) -> dict:
        min_choices = attrs.get('min_choices', getattr(self.instance, 'min_choices', 0))
        max_choices = attrs.get('max_choices', getattr(self.instance, 'max_choices', MIN_MAX_CHOICES))
        if max_choices < min_choices:
            raise serializers.ValidationError({'max_choices': 'El máximo no puede ser menor que el mínimo.'})
        options = attrs.get('modifiers')
        if options is None:
            options = [{'active': modifier.active} for modifier in self._existing_modifiers()]
        else:
            self._validate_option_ids(options)
        active_count = sum(1 for option in options if option.get('active', True))
        if active_count < min_choices:
            raise serializers.ValidationError(
                {'min_choices': f'El grupo pide {min_choices} opciones y solo tiene {active_count} activas.'}
            )
        return attrs

    def create(self, validated_data: dict) -> ModifierGroup:
        options = validated_data.pop('modifiers', [])
        with transaction.atomic():
            group = ModifierGroup.objects.create(**validated_data)
            sync_modifiers(group, options)
        return group

    def update(self, instance: ModifierGroup, validated_data: dict) -> ModifierGroup:
        options = validated_data.pop('modifiers', None)
        with transaction.atomic():
            group = super().update(instance, validated_data)
            if options is not None:
                sync_modifiers(group, options)
        return group

    def to_representation(self, instance: ModifierGroup) -> dict:
        data = super().to_representation(instance)
        data['modifiers'] = ModifierWriteSerializer(instance.modifiers.all(), many=True).data
        return data

    def _existing_modifiers(self) -> list[Modifier]:
        return list(self.instance.modifiers.all()) if self.instance else []

    def _validate_option_ids(self, options: list[dict]) -> None:
        ids = [option['id'] for option in options if 'id' in option]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError({'modifiers': 'Hay opciones repetidas.'})
        known = {modifier.pk for modifier in self._existing_modifiers()}
        if not set(ids) <= known:
            raise serializers.ValidationError({'modifiers': 'Hay opciones que no pertenecen a este grupo.'})
