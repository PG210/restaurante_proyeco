from rest_framework import serializers

from orders.models import MIN_ORDER_QUANTITY, ORDER_TEXT_MAX_LENGTH, Order, OrderModifier, OrderStatus
from orders.services import OrderItem
from products.api.serializers import ProductSerializer
from products.models import Product
from products.modifiers import (
    MAX_MODIFIERS_PER_ITEM,
    ModifierSelectionError,
    resolve_modifiers,
    with_modifier_groups,
)
from tables.api.serializers import TableSerializer
from tables.models import Table

MAX_BULK_ADVANCE_ORDERS = 100
PRODUCT_NOT_ORDERABLE_MESSAGE = 'El producto no está disponible.'


class OrderModifierSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderModifier
        fields = ['group_name', 'modifier_name', 'price_delta']
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    product_data = ProductSerializer(source='product', read_only=True)
    modifiers = OrderModifierSerializer(many=True, read_only=True)
    table_data = TableSerializer(source='table', read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True, default=None)

    class Meta:
        model = Order
        fields = [
            'id',
            'status',
            'table',
            'table_data',
            'product',
            'product_data',
            'modifiers',
            'quantity',
            'notes',
            'price',
            'preparation_minutes',
            'kitchen_at',
            'created_by',
            'created_by_email',
            'cancel_reason',
            'close',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class OrderItemSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    quantity = serializers.IntegerField(min_value=MIN_ORDER_QUANTITY, default=MIN_ORDER_QUANTITY)
    notes = serializers.CharField(max_length=ORDER_TEXT_MAX_LENGTH, allow_blank=True, default='')
    modifiers = serializers.ListField(
        child=serializers.IntegerField(min_value=1), default=list, max_length=MAX_MODIFIERS_PER_ITEM
    )

    def validate_product(self, product: Product) -> Product:
        orderable = with_modifier_groups(Product.objects.orderable().filter(pk=product.pk)).first()
        if orderable is None:
            raise serializers.ValidationError(PRODUCT_NOT_ORDERABLE_MESSAGE)
        return orderable

    def validate(self, attrs: dict) -> dict:
        try:
            modifiers = resolve_modifiers(attrs['product'], attrs['modifiers'])
        except ModifierSelectionError as error:
            raise serializers.ValidationError({'modifiers': str(error)}) from error
        return {**attrs, 'modifiers': modifiers}


class OrderCreateSerializer(OrderItemSerializer):
    table = serializers.PrimaryKeyRelatedField(queryset=Table.objects.all())

    def to_order_items(self) -> list[OrderItem]:
        item_fields = {key: value for key, value in self.validated_data.items() if key != 'table'}
        return [OrderItem(**item_fields)]


class OrderBulkCreateSerializer(serializers.Serializer):
    table = serializers.PrimaryKeyRelatedField(queryset=Table.objects.all())
    items = OrderItemSerializer(many=True, allow_empty=False)

    def to_order_items(self) -> list[OrderItem]:
        return [OrderItem(**item) for item in self.validated_data['items']]


class OrderUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['quantity', 'notes']

    def validate(self, attrs: dict) -> dict:
        if self.instance.status != OrderStatus.PENDING:
            raise serializers.ValidationError('Solo se pueden modificar pedidos pendientes.')
        return attrs


class OrderCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=ORDER_TEXT_MAX_LENGTH, allow_blank=False)


class OrderBulkAdvanceSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), allow_empty=False, max_length=MAX_BULK_ADVANCE_ORDERS
    )

    def validate_ids(self, ids: list[int]) -> list[int]:
        return sorted(set(ids))
