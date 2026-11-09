from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from orders.permissions import VIEW_ORDER, qualified_permission
from tables.api.serializers import TableSerializer, TableSummarySerializer
from tables.models import Table
from tables.services import tables_with_open_orders_summary
from users.api.permissions import IsAdminOrReadOnly, require_permission


class TableApiViewSet(ModelViewSet):
    queryset = Table.objects.order_by('number')
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]
    serializer_class = TableSerializer

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[require_permission(qualified_permission(VIEW_ORDER))],
    )
    def summary(self, request):
        serializer = TableSummarySerializer(tables_with_open_orders_summary(), many=True)
        return Response(serializer.data)
