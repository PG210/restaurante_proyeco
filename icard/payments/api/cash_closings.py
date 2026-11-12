from decimal import Decimal

from rest_framework import mixins, serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from payments.api.serializers import user_display_name
from payments.cash_register import (
    CashClosingError,
    CashCount,
    add_closing_note,
    close_cash_register,
    todays_closing,
    void_cash_closing,
)
from payments.models import (
    MONEY_DECIMAL_PLACES,
    MONEY_MAX_DIGITS,
    PAYMENT_REASON_MAX_LENGTH,
    ZERO,
    CashClosing,
    CashClosingLine,
    PaymentMethod,
)
from payments.permissions import CLOSE_CASH_REGISTER, VIEW_PAYMENTS, qualified_permission
from products.service_day import current_service_day
from users.api.permissions import HasActionPermission

CLOSINGS_PAGE_SIZE = 30
CAN_CLOSE = qualified_permission(CLOSE_CASH_REGISTER)
CAN_VIEW_PAYMENTS = qualified_permission(VIEW_PAYMENTS)


def money_input() -> serializers.DecimalField:
    return serializers.DecimalField(
        max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, min_value=ZERO
    )


class CashClosingLineSerializer(serializers.ModelSerializer):
    method_label = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = CashClosingLine
        fields = ['method', 'method_label', 'expected', 'counted', 'difference']
        read_only_fields = fields


class CashClosingSerializer(serializers.ModelSerializer):
    lines = CashClosingLineSerializer(many=True, read_only=True)
    closed_by_name = serializers.SerializerMethodField()
    voided_by_name = serializers.SerializerMethodField()
    total_difference = serializers.SerializerMethodField()
    needs_note = serializers.SerializerMethodField()

    class Meta:
        model = CashClosing
        fields = [
            'id',
            'service_day',
            'opening_float',
            'note',
            'needs_note',
            'closed_at',
            'closed_by_name',
            'voided_at',
            'voided_by_name',
            'void_reason',
            'lines',
            'total_difference',
        ]
        read_only_fields = fields

    def get_closed_by_name(self, closing: CashClosing) -> str | None:
        return user_display_name(closing.closed_by)

    def get_voided_by_name(self, closing: CashClosing) -> str | None:
        return user_display_name(closing.voided_by)

    def get_total_difference(self, closing: CashClosing) -> str:
        return str(sum((line.difference for line in closing.lines.all()), ZERO))

    def get_needs_note(self, closing: CashClosing) -> bool:
        has_difference = any(line.difference != ZERO for line in closing.lines.all())
        return has_difference and not closing.note and closing.voided_at is None


class CountedSerializer(serializers.Serializer):
    CASH = money_input()
    CARD = money_input()
    TRANSFER = money_input()


class CashCountSerializer(serializers.Serializer):
    opening_float = money_input()
    counted = CountedSerializer()
    note = serializers.CharField(max_length=PAYMENT_REASON_MAX_LENGTH, allow_blank=True, default='')

    def to_cash_count(self) -> CashCount:
        data = self.validated_data
        counted = {method: Decimal(data['counted'][method]) for method in PaymentMethod.values}
        return CashCount(opening_float=data['opening_float'], counted=counted, note=data['note'])


class TextSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=PAYMENT_REASON_MAX_LENGTH, allow_blank=False)


class CashClosingPagination(PageNumberPagination):
    page_size = CLOSINGS_PAGE_SIZE


class CashClosingViewSet(mixins.ListModelMixin, GenericViewSet):
    permission_classes = [HasActionPermission]
    action_permissions = {
        'list': CAN_VIEW_PAYMENTS,
        'today': (CAN_CLOSE, CAN_VIEW_PAYMENTS),
        'create': CAN_CLOSE,
        'note': CAN_CLOSE,
    }
    serializer_class = CashClosingSerializer
    pagination_class = CashClosingPagination
    queryset = CashClosing.objects.select_related('closed_by', 'voided_by').prefetch_related('lines')

    def get_permissions(self):
        if self.action == 'void':
            return [IsAdminUser()]
        return super().get_permissions()

    def create(self, request):
        serializer = CashCountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            closing = close_cash_register(serializer.to_cash_count(), request.user)
        except CashClosingError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(self._render(closing), status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def today(self, request):
        closing = todays_closing()
        return Response(
            {
                'service_day': current_service_day(),
                'closing': self._render(closing) if closing else None,
            }
        )

    @action(detail=True, methods=['post'])
    def note(self, request, pk=None):
        text = self._text(request)
        return self._apply(lambda closing: add_closing_note(closing, text))

    @action(detail=True, methods=['post'])
    def void(self, request, pk=None):
        reason = self._text(request)
        return self._apply(lambda closing: void_cash_closing(closing, reason, request.user))

    def _apply(self, operation) -> Response:
        try:
            closing = operation(self.get_object())
        except CashClosingError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(self._render(closing))

    def _render(self, closing: CashClosing) -> dict:
        return CashClosingSerializer(self.get_queryset().get(pk=closing.pk)).data

    @staticmethod
    def _text(request) -> str:
        serializer = TextSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data['text']
