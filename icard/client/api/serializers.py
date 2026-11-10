from django.conf import settings
from rest_framework import serializers

from configuration.services import get_settings
from orders.api.serializers import OrderItemSerializer
from orders.models import Order
from orders.services import OrderItem
from tables.models import Table


class ClientTableSerializer(serializers.ModelSerializer):
    bill_requested = serializers.BooleanField(read_only=True)
    payment_mode = serializers.SerializerMethodField()

    class Meta:
        model = Table
        fields = ['number', 'is_open', 'bill_requested', 'payment_mode']

    def get_payment_mode(self, table: Table) -> str:
        return get_settings().payment_mode


class ClientOrderSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source='product.title', read_only=True, default=None)

    class Meta:
        model = Order
        fields = ['id', 'product', 'product_title', 'quantity', 'notes', 'price', 'status', 'created_at']
        read_only_fields = fields


class ClientOrderItemSerializer(OrderItemSerializer):
    quantity = serializers.IntegerField(
        min_value=1, max_value=settings.CLIENT_MAX_QUANTITY_PER_ITEM, default=1
    )


class ClientOrderCreateSerializer(serializers.Serializer):
    items = ClientOrderItemSerializer(
        many=True, allow_empty=False, max_length=settings.CLIENT_MAX_ITEMS_PER_ORDER
    )

    def to_order_items(self) -> list[OrderItem]:
        return [OrderItem(**item) for item in self.validated_data['items']]
