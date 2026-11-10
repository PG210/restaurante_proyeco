from rest_framework import serializers

from categories.api.serializers import CategorySerializer
from icard.serializers import OptimizedImageMixin
from products.models import Product


class ProductSerializer(OptimizedImageMixin, serializers.ModelSerializer):
    category_data = CategorySerializer(source='category', read_only=True)
    is_available = serializers.BooleanField(read_only=True)

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
            'position',
            'category',
            'category_data',
        ]


class ProductAvailabilitySerializer(serializers.Serializer):
    is_available = serializers.BooleanField()


class RestockResultSerializer(serializers.Serializer):
    restocked = serializers.IntegerField()
