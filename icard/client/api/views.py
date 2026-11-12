from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from client.api.serializers import ClientOrderCreateSerializer, ClientOrderSerializer, ClientTableSerializer
from client.api.throttles import (
    ClientIpThrottle,
    ClientTableBillThrottle,
    ClientTableOrderThrottle,
    ClientTableReadThrottle,
    ClientTableWaiterThrottle,
)
from client.services import ClientOrderLimitError, create_client_orders, open_orders_for_table
from products.stock import InsufficientStockError
from tables.models import Table
from tables.services import (
    TableClosedError,
    TableNotFoundError,
    call_waiter,
    get_open_table_by_token,
    get_table_by_token,
    request_bill,
)

TABLE_NOT_FOUND_MESSAGE = 'Este código QR no es válido.'
TABLE_CLOSED_MESSAGE = 'La mesa aún no está habilitada. Llama al mesero.'


class ClientApiView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_by_method: dict = {}

    def get_throttles(self):
        table_throttle = self.throttle_by_method.get(self.request.method)
        throttles = [ClientIpThrottle]
        if table_throttle is not None:
            throttles.append(table_throttle)
        return [throttle() for throttle in throttles]

    def get_table(self, token: str) -> Table:
        try:
            return get_table_by_token(token)
        except TableNotFoundError as error:
            raise NotFound(TABLE_NOT_FOUND_MESSAGE) from error

    def get_open_table(self, token: str) -> Table:
        try:
            return get_open_table_by_token(token)
        except TableNotFoundError as error:
            raise NotFound(TABLE_NOT_FOUND_MESSAGE) from error
        except TableClosedError as error:
            raise PermissionDenied(TABLE_CLOSED_MESSAGE) from error


class ClientTableView(ClientApiView):
    throttle_by_method = {'GET': ClientTableReadThrottle}

    def get(self, request, token: str):
        return Response(ClientTableSerializer(self.get_table(token)).data)


class ClientOrdersView(ClientApiView):
    throttle_by_method = {'GET': ClientTableReadThrottle, 'POST': ClientTableOrderThrottle}

    def get(self, request, token: str):
        orders = open_orders_for_table(self.get_table(token))
        return Response(ClientOrderSerializer(orders, many=True).data)

    def post(self, request, token: str):
        table = self.get_open_table(token)
        serializer = ClientOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            orders = create_client_orders(table, serializer.to_order_items())
        except ClientOrderLimitError as error:
            raise ValidationError({'items': str(error)}) from error
        except InsufficientStockError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(ClientOrderSerializer(orders, many=True).data, status=status.HTTP_201_CREATED)


class ClientBillView(ClientApiView):
    throttle_by_method = {'POST': ClientTableBillThrottle}

    def post(self, request, token: str):
        table = request_bill(self.get_open_table(token))
        return Response(ClientTableSerializer(table).data)


class ClientWaiterView(ClientApiView):
    throttle_by_method = {'POST': ClientTableWaiterThrottle}

    def post(self, request, token: str):
        table = call_waiter(self.get_open_table(token))
        return Response(ClientTableSerializer(table).data)
