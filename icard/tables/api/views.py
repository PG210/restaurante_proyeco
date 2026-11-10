from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from orders.permissions import VIEW_ORDER
from orders.permissions import qualified_permission as qualified_order_permission
from payments.services import TableHasOpenBillError, close_table_checking_bill
from tables.api.serializers import TableAdminSerializer, TableSerializer, TableSummarySerializer
from tables.models import Table
from tables.permissions import ATTEND_BILL_REQUEST, OPEN_TABLE
from tables.permissions import qualified_permission as qualified_table_permission
from tables.services import (
    attend_bill_request,
    open_table,
    regenerate_token,
    tables_with_open_orders_summary,
)
from users.api.permissions import IsAdminOrReadOnly, require_permission

CAN_VIEW_ORDERS = require_permission(qualified_order_permission(VIEW_ORDER))
CAN_OPEN_TABLES = require_permission(qualified_table_permission(OPEN_TABLE))
CAN_ATTEND_BILLS = require_permission(qualified_table_permission(ATTEND_BILL_REQUEST))


class TableApiViewSet(ModelViewSet):
    queryset = Table.objects.order_by('number')
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get_serializer_class(self):
        return TableAdminSerializer if self.request.user.is_staff else TableSerializer

    @action(detail=False, methods=['get'], permission_classes=[CAN_VIEW_ORDERS])
    def summary(self, request):
        serializer = TableSummarySerializer(tables_with_open_orders_summary(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[CAN_OPEN_TABLES])
    def open(self, request, pk=None):
        return self._table_response(open_table(self.get_object()))

    @action(detail=True, methods=['post'], permission_classes=[CAN_OPEN_TABLES])
    def close(self, request, pk=None):
        try:
            table = close_table_checking_bill(self.get_object(), request.user)
        except TableHasOpenBillError as error:
            raise ValidationError({'detail': str(error)}) from error
        return self._table_response(table)

    @action(detail=True, methods=['post'], url_path='attend-bill', permission_classes=[CAN_ATTEND_BILLS])
    def attend_bill(self, request, pk=None):
        return self._table_response(attend_bill_request(self.get_object()))

    @action(detail=True, methods=['post'], url_path='regenerate-token', permission_classes=[IsAdminUser])
    def regenerate_token(self, request, pk=None):
        return self._table_response(regenerate_token(self.get_object()))

    def _table_response(self, table: Table) -> Response:
        return Response(self.get_serializer(table).data)
