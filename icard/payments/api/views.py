from django.db.models import Count, Prefetch, Sum
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from orders.models import Order
from orders.permissions import VIEW_ORDER
from orders.permissions import qualified_permission as qualified_order_permission
from payments.api.filters import BillFilter
from payments.api.serializers import (
    BillHistorySerializer,
    BillSerializer,
    ChargeSerializer,
    PaymentSerializer,
    ReversePaymentSerializer,
)
from payments.models import Bill, BillStatus, Payment
from payments.permissions import CHARGE_BILL, VIEW_PAYMENTS, qualified_permission
from payments.services import BillError, charge, get_open_bill, reverse_payment
from payments.tax import to_money
from tables.models import Table
from users.api.permissions import HasActionPermission

HISTORY_PAGE_SIZE = 50
CAN_CHARGE = qualified_permission(CHARGE_BILL)
CAN_VIEW_PAYMENTS = qualified_permission(VIEW_PAYMENTS)
NO_OPEN_BILL_MESSAGE = 'La mesa no tiene una cuenta abierta.'


class BillHistoryPagination(PageNumberPagination):
    page_size = HISTORY_PAGE_SIZE


def _bill_queryset():
    payments = Payment.objects.select_related('created_by', 'reversal').order_by('created_at')
    lines = Order.objects.select_related('product').order_by('created_at')
    return Bill.objects.select_related('closed_by').prefetch_related(
        Prefetch('payments', queryset=payments), Prefetch('orders', queryset=lines)
    )


def _raise_as_validation_error(error: BillError) -> None:
    raise ValidationError({'detail': str(error)}) from error


class BillViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    permission_classes = [HasActionPermission]
    action_permissions = {
        'list': CAN_VIEW_PAYMENTS,
        'summary': CAN_VIEW_PAYMENTS,
        'retrieve': (CAN_CHARGE, CAN_VIEW_PAYMENTS),
        'current': qualified_order_permission(VIEW_ORDER),
        'payments': CAN_CHARGE,
    }
    filter_backends = [DjangoFilterBackend]
    filterset_class = BillFilter
    pagination_class = BillHistoryPagination

    def get_queryset(self):
        queryset = _bill_queryset()
        return queryset.order_by('-closed_at', '-id') if self.action in ('list', 'summary') else queryset

    def get_serializer_class(self):
        return BillHistorySerializer if self.action == 'list' else BillSerializer

    @action(detail=False, methods=['get'])
    def current(self, request):
        table = get_object_or_404(Table, pk=self._table_id_param(request))
        bill = get_open_bill(table)
        if bill is None:
            raise NotFound(NO_OPEN_BILL_MESSAGE)
        return Response(BillSerializer(_bill_queryset().get(pk=bill.pk)).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        bills = self.filter_queryset(self.get_queryset()).filter(status=BillStatus.PAID)
        totals = bills.aggregate(
            count=Count('id'), total=Sum('total_paid'), tips=Sum('tip_total'), tax=Sum('tax_amount')
        )
        payments = Payment.objects.filter(bill__in=bills.values('id'))
        if request.query_params.get('method'):
            payments = payments.filter(method=request.query_params['method'])
        by_method = (
            payments.values('method').annotate(amount=Sum('amount'), tips=Sum('tip')).order_by('method')
        )
        return Response(
            {
                'bills': totals['count'],
                'total': str(to_money(totals['total'])),
                'tips': str(to_money(totals['tips'])),
                'tax': str(to_money(totals['tax'])),
                'by_method': [
                    {
                        'method': row['method'],
                        'amount': str(to_money(row['amount'])),
                        'tips': str(to_money(row['tips'])),
                    }
                    for row in by_method
                ],
            }
        )

    @action(detail=True, methods=['post'])
    def payments(self, request, pk=None):
        bill = self.get_object()
        serializer = ChargeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            charge(bill, serializer.to_charge_request(), request.user)
        except BillError as error:
            _raise_as_validation_error(error)
        return Response(BillSerializer(_bill_queryset().get(pk=bill.pk)).data, status=status.HTTP_201_CREATED)

    @staticmethod
    def _table_id_param(request) -> int:
        raw_table_id = request.query_params.get('table', '')
        if not raw_table_id.isdigit():
            raise ValidationError({'table': 'Indica el id numérico de la mesa.'})
        return int(raw_table_id)


class PaymentReverseView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk: int):
        payment = get_object_or_404(Payment, pk=pk)
        serializer = ReversePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reversal = reverse_payment(payment, serializer.validated_data['reason'], request.user)
        except BillError as error:
            _raise_as_validation_error(error)
        return Response(PaymentSerializer(reversal).data, status=status.HTTP_201_CREATED)
