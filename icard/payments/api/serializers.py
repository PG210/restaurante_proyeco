from decimal import Decimal

from rest_framework import serializers

from orders.api.serializers import OrderModifierSerializer
from orders.models import Order
from payments.models import (
    MONEY_DECIMAL_PLACES,
    MONEY_MAX_DIGITS,
    PAYMENT_REASON_MAX_LENGTH,
    PAYMENT_REFERENCE_MAX_LENGTH,
    ZERO,
    Bill,
    Payment,
    PaymentMethod,
)
from payments.services import ChargeRequest, bill_totals, has_orders_in_progress
from payments.tax import MONEY_QUANTUM

MINIMUM_AMOUNT = Decimal('0.01')


def money_field(**kwargs) -> serializers.DecimalField:
    return serializers.DecimalField(
        max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, coerce_to_string=True, **kwargs
    )


def user_display_name(user) -> str | None:
    if user is None:
        return None
    full_name = f'{user.first_name} {user.last_name}'.strip()
    return full_name or user.email


class PaymentSerializer(serializers.ModelSerializer):
    method_label = serializers.CharField(source='get_method_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    is_reversed = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            'id',
            'method',
            'method_label',
            'amount',
            'tip',
            'reference',
            'reason',
            'reverses',
            'is_reversed',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = fields

    def get_created_by_name(self, payment: Payment) -> str | None:
        return user_display_name(payment.created_by)

    def get_is_reversed(self, payment: Payment) -> bool:
        try:
            return payment.reversal is not None
        except Payment.reversal.RelatedObjectDoesNotExist:
            return False


class BillLineSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source='product.title', read_only=True, default=None)
    modifiers = OrderModifierSerializer(many=True, read_only=True)
    line_total = serializers.SerializerMethodField()
    is_paid = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id',
            'product_title',
            'modifiers',
            'quantity',
            'price',
            'line_total',
            'status',
            'notes',
            'is_paid',
        ]
        read_only_fields = fields

    def get_line_total(self, order: Order) -> str | None:
        if order.price is None:
            return None
        return str((order.price * order.quantity).quantize(MONEY_QUANTUM))

    def get_is_paid(self, order: Order) -> bool:
        return order.payment_id is not None


class BillSerializer(serializers.ModelSerializer):
    closed_by_name = serializers.SerializerMethodField()
    totals = serializers.SerializerMethodField()
    orders_in_progress = serializers.SerializerMethodField()
    lines = BillLineSerializer(source='orders', many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Bill
        fields = [
            'id',
            'table',
            'table_number',
            'status',
            'opened_at',
            'closed_at',
            'closed_by_name',
            'payment_mode',
            'tax_type',
            'tax_rate',
            'totals',
            'orders_in_progress',
            'lines',
            'payments',
        ]
        read_only_fields = fields

    def get_closed_by_name(self, bill: Bill) -> str | None:
        return user_display_name(bill.closed_by)

    def get_totals(self, bill: Bill) -> dict:
        totals = bill_totals(bill)
        return {
            'subtotal': str(totals.subtotal),
            'paid': str(totals.paid),
            'tips': str(totals.tips),
            'balance': str(totals.balance),
            'tax_base': str(totals.tax_base),
            'tax': str(totals.tax),
        }

    def get_orders_in_progress(self, bill: Bill) -> bool:
        return has_orders_in_progress(bill)


class BillHistorySerializer(serializers.ModelSerializer):
    closed_by_name = serializers.SerializerMethodField()
    methods = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            'id',
            'table_number',
            'status',
            'opened_at',
            'closed_at',
            'closed_by_name',
            'subtotal',
            'tip_total',
            'total_paid',
            'tax_type',
            'tax_amount',
            'methods',
        ]
        read_only_fields = fields

    def get_closed_by_name(self, bill: Bill) -> str | None:
        return user_display_name(bill.closed_by)

    def get_methods(self, bill: Bill) -> list[str]:
        return sorted({payment.method for payment in bill.payments.all()})


class ChargeSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=PaymentMethod.choices)
    amount = money_field(min_value=MINIMUM_AMOUNT)
    tip = money_field(min_value=ZERO, default=ZERO)
    reference = serializers.CharField(
        max_length=PAYMENT_REFERENCE_MAX_LENGTH, allow_blank=True, required=False, default=''
    )
    orders = serializers.ListField(
        child=serializers.IntegerField(min_value=1), required=False, default=list, allow_empty=True
    )

    def to_charge_request(self) -> ChargeRequest:
        data = dict(self.validated_data)
        order_ids = tuple(sorted(set(data.pop('orders'))))
        return ChargeRequest(**data, order_ids=order_ids)


class ReversePaymentSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=PAYMENT_REASON_MAX_LENGTH, allow_blank=False)
