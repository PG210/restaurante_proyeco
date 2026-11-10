from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.viewsets import ModelViewSet

from icard.media import ImageCleanupMixin
from products.api.filters import ProductFilter
from products.api.serializers import (
    ProductAvailabilitySerializer,
    ProductSerializer,
    RestockResultSerializer,
)
from products.models import Product
from products.permissions import SET_PRODUCT_AVAILABILITY, qualified_permission
from products.services import restock_all, set_availability
from users.api.permissions import IsAdminOrReadOnly, require_permission

AVAILABILITY_ACTIONS = ('availability', 'restock')
CanSetAvailability = require_permission(qualified_permission(SET_PRODUCT_AVAILABILITY))


class ProductApiViewSet(ImageCleanupMixin, ModelViewSet):
    throttle_classes = [AnonRateThrottle]
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = ProductFilter

    def get_permissions(self):
        if self.action in AVAILABILITY_ACTIONS:
            return [CanSetAvailability()]
        return [IsAdminOrReadOnly()]

    def get_queryset(self):
        queryset = Product.objects.select_related('category')
        if self.request.user.is_staff:
            return queryset
        return queryset.in_visible_category()

    @action(detail=True, methods=['patch'])
    def availability(self, request, pk=None):
        serializer = ProductAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = set_availability(self.get_object(), serializer.validated_data['is_available'], request.user)
        return Response(ProductSerializer(product, context=self.get_serializer_context()).data)

    @action(detail=False, methods=['post'])
    def restock(self, request):
        result = RestockResultSerializer({'restocked': restock_all(request.user)})
        return Response(result.data, status=status.HTTP_200_OK)
