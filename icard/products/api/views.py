from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.throttling import AnonRateThrottle
from rest_framework.viewsets import ModelViewSet

from products.api.serializers import ProductSerializer
from products.models import Product
from users.api.permissions import IsAdminOrReadOnly


class ProductApiViewSet(ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    throttle_classes = [AnonRateThrottle]
    queryset = Product.objects.select_related('category')
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'active']
