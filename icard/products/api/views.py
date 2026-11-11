from django.db import transaction
from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import SearchFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.viewsets import ModelViewSet

from icard.media import ImageCleanupMixin
from products.api.filters import ProductFilter
from products.api.serializers import (
    AddStockSerializer,
    ModifierGroupSerializer,
    ProductAvailabilitySerializer,
    ProductModifierGroupsSerializer,
    ProductSerializer,
    RestockResultSerializer,
    SetStockSerializer,
    StockMovementSerializer,
)
from products.models import ModifierGroup, Product
from products.modifiers import with_modifier_groups
from products.permissions import MANAGE_STOCK, SET_PRODUCT_AVAILABILITY, qualified_permission
from products.services import restock_all, set_availability
from products.stock import StockError, add_stock, record_product_edit, set_stock, with_sold_today
from users.api.permissions import IsAdminOrReadOnly, require_permission
from users.permissions import user_has_permission

MOVEMENTS_PAGE_SIZE = 50
CAN_MANAGE_STOCK = qualified_permission(MANAGE_STOCK)
ACTION_PERMISSIONS = {
    'availability': require_permission(qualified_permission(SET_PRODUCT_AVAILABILITY)),
    'restock': require_permission(qualified_permission(SET_PRODUCT_AVAILABILITY)),
    'add_stock': require_permission(CAN_MANAGE_STOCK),
    'set_stock': require_permission(CAN_MANAGE_STOCK),
    'stock_movements': require_permission(CAN_MANAGE_STOCK),
}


class StockMovementPagination(PageNumberPagination):
    page_size = MOVEMENTS_PAGE_SIZE


class ProductApiViewSet(ImageCleanupMixin, ModelViewSet):
    throttle_classes = [AnonRateThrottle]
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = ProductFilter

    def get_permissions(self):
        permission_class = ACTION_PERMISSIONS.get(self.action, IsAdminOrReadOnly)
        return [permission_class()]

    def get_queryset(self):
        queryset = with_modifier_groups(Product.objects.select_related('category'))
        if self._shows_stock():
            queryset = with_sold_today(queryset)
        if self.request.user.is_staff:
            return queryset
        return queryset.in_visible_category()

    def get_serializer_context(self) -> dict:
        return {**super().get_serializer_context(), 'show_stock': self._shows_stock()}

    def perform_create(self, serializer) -> None:
        with transaction.atomic():
            product = serializer.save()
            record_product_edit(None, product, self.request.user)

    def save_update(self, serializer):
        locked = Product.objects.select_for_update().get(pk=serializer.instance.pk)
        previous_stock = locked.stock
        if 'stock' not in serializer.validated_data:
            serializer.instance.stock = locked.stock
        serializer.instance.sold_out_on = locked.sold_out_on
        product = serializer.save()
        record_product_edit(previous_stock, product, self.request.user)
        return product

    @action(detail=True, methods=['put'], url_path='modifier-groups')
    def modifier_groups(self, request, pk=None):
        serializer = ProductModifierGroupsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = self.get_object()
        product.modifier_groups.set(serializer.validated_data['modifier_group_ids'])
        return self._product_response(product)

    @action(detail=True, methods=['patch'])
    def availability(self, request, pk=None):
        serializer = ProductAvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = set_availability(self.get_object(), serializer.validated_data['is_available'], request.user)
        return self._product_response(product)

    @action(detail=False, methods=['post'])
    def restock(self, request):
        result = RestockResultSerializer({'restocked': restock_all(request.user)})
        return Response(result.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='stock/add')
    def add_stock(self, request, pk=None):
        serializer = AddStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        units = serializer.validated_data['units']
        return self._stock_change(lambda product: add_stock(product, units, request.user))

    @action(detail=True, methods=['post'], url_path='stock/set')
    def set_stock(self, request, pk=None):
        serializer = SetStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        units, note = serializer.validated_data['units'], serializer.validated_data['note']
        return self._stock_change(lambda product: set_stock(product, units, note, request.user))

    @action(detail=True, methods=['get'], url_path='stock-movements')
    def stock_movements(self, request, pk=None):
        movements = self.get_object().stock_movements.select_related('created_by')
        paginator = StockMovementPagination()
        page = paginator.paginate_queryset(movements, request, view=self)
        return paginator.get_paginated_response(StockMovementSerializer(page, many=True).data)

    def _stock_change(self, operation) -> Response:
        try:
            product = operation(self.get_object())
        except StockError as error:
            raise ValidationError({'detail': str(error)}) from error
        return self._product_response(product)

    def _product_response(self, product: Product) -> Response:
        refreshed = self.get_queryset().get(pk=product.pk)
        return Response(ProductSerializer(refreshed, context=self.get_serializer_context()).data)

    def _shows_stock(self) -> bool:
        return user_has_permission(self.request.user, CAN_MANAGE_STOCK)


class ModifierGroupViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = ModifierGroupSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['active']
    search_fields = ['name', 'modifiers__name']

    def get_queryset(self):
        return (
            ModifierGroup.objects.annotate(product_count=Count('products', distinct=True))
            .prefetch_related('modifiers')
            .distinct()
        )
