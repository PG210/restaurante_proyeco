from rest_framework import serializers

from categories.api.serializers import CategorySerializer
from icard.serializers import OptimizedImageMixin
from products.models import STOCK_NOTE_MAX_LENGTH, Product, StockMovement

STOCK_FIELDS = ('stock', 'low_stock_threshold', 'low_stock', 'sold_today')
MIN_RESTOCK_UNITS = 1


class ProductSerializer(OptimizedImageMixin, serializers.ModelSerializer):
    category_data = CategorySerializer(source='category', read_only=True)
    is_available = serializers.BooleanField(read_only=True)
    sold_out_today = serializers.BooleanField(source='is_sold_out_today', read_only=True)
    low_stock = serializers.BooleanField(source='is_low_stock', read_only=True)
    sold_today = serializers.SerializerMethodField()

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
            *STOCK_FIELDS,
        ]

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
