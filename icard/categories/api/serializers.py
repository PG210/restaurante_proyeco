from rest_framework.serializers import ModelSerializer

from categories.models import Category
from icard.serializers import OptimizedImageMixin


class CategorySerializer(OptimizedImageMixin, ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'title', 'image', 'active', 'position']
