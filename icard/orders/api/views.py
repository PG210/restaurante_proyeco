from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from orders.api.filters import OrderFilter
from orders.api.serializers import (
    OrderBulkAdvanceSerializer,
    OrderBulkCreateSerializer,
    OrderCancelSerializer,
    OrderCreateSerializer,
    OrderSerializer,
    OrderUpdateSerializer,
)
from orders.models import Order
from orders.permissions import (
    ADD_ORDER,
    CANCEL_ORDER,
    CHANGE_ORDER,
    DELETE_ORDER,
    VIEW_ORDER,
    qualified_permission,
)
from orders.services import (
    OrderNotFoundError,
    OrderPermissionError,
    OrderTransitionError,
    advance_order,
    advance_orders,
    cancel_order,
    create_orders,
)
from users.api.permissions import HasActionPermission

WRITE_SERIALIZERS = {
    'create': OrderCreateSerializer,
    'bulk': OrderBulkCreateSerializer,
    'bulk_advance': OrderBulkAdvanceSerializer,
    'update': OrderUpdateSerializer,
    'partial_update': OrderUpdateSerializer,
    'cancel': OrderCancelSerializer,
}


class OrderApiViewSet(ModelViewSet):
    permission_classes = [HasActionPermission]
    action_permissions = {
        'list': qualified_permission(VIEW_ORDER),
        'retrieve': qualified_permission(VIEW_ORDER),
        'create': qualified_permission(ADD_ORDER),
        'bulk': qualified_permission(ADD_ORDER),
        'advance': qualified_permission(VIEW_ORDER),
        'bulk_advance': qualified_permission(VIEW_ORDER),
        'cancel': qualified_permission(CANCEL_ORDER),
        'update': qualified_permission(CHANGE_ORDER),
        'partial_update': qualified_permission(CHANGE_ORDER),
        'destroy': qualified_permission(DELETE_ORDER),
    }
    queryset = Order.objects.select_related('table', 'product__category', 'created_by')
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = OrderFilter
    ordering_fields = [
        'id',
        'created_at',
        'status',
        'table',
        'product',
        'close',
    ]
    ordering = ['-created_at']

    def get_serializer_class(self):
        return WRITE_SERIALIZERS.get(self.action, OrderSerializer)

    def create(self, request, *args, **kwargs):
        return self._create_from(self.get_serializer(data=request.data))

    @action(detail=False, methods=['post'])
    def bulk(self, request):
        return self._create_from(self.get_serializer(data=request.data))

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        return self._order_response(self.get_object())

    @action(detail=True, methods=['post'])
    def advance(self, request, pk=None):
        return self._transition(lambda order: advance_order(order, request.user))

    @action(detail=False, methods=['post'], url_path='bulk-advance')
    def bulk_advance(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order_ids = serializer.validated_data['ids']
        _run_transition(lambda: advance_orders(order_ids, request.user))
        advanced = self.get_queryset().filter(pk__in=order_ids).order_by('pk')
        return Response(OrderSerializer(advanced, many=True).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data['reason']
        return self._transition(lambda order: cancel_order(order, reason, request.user))

    def _create_from(self, serializer) -> Response:
        serializer.is_valid(raise_exception=True)
        orders = create_orders(
            serializer.validated_data['table'], serializer.to_order_items(), self.request.user
        )
        created = self.get_queryset().filter(pk__in=[order.pk for order in orders])
        response_data = OrderSerializer(created, many=True).data
        if self.action == 'create':
            response_data = response_data[0]
        return Response(response_data, status=status.HTTP_201_CREATED)

    def _transition(self, operation) -> Response:
        order = self.get_object()
        _run_transition(lambda: operation(order))
        return self._order_response(self.get_object())

    def _order_response(self, order: Order) -> Response:
        return Response(OrderSerializer(order).data)


def _run_transition(operation) -> None:
    try:
        operation()
    except OrderTransitionError as error:
        raise ValidationError({'status': str(error)}) from error
    except OrderNotFoundError as error:
        raise ValidationError({'ids': str(error)}) from error
    except OrderPermissionError as error:
        raise PermissionDenied(str(error)) from error
