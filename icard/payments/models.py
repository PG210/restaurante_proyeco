from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from configuration.models import PaymentMode, TaxType, rate_field

MONEY_MAX_DIGITS = 10
MONEY_DECIMAL_PLACES = 2
ZERO = Decimal('0.00')
PAYMENT_REFERENCE_MAX_LENGTH = 64
PAYMENT_REASON_MAX_LENGTH = 255


def money_field(**kwargs) -> models.DecimalField:
    return models.DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, **kwargs)


class BillStatus(models.TextChoices):
    OPEN = 'OPEN', 'Abierta'
    PAID = 'PAID', 'Pagada'


class PaymentMethod(models.TextChoices):
    CASH = 'CASH', 'Efectivo'
    CARD = 'CARD', 'Tarjeta'
    TRANSFER = 'TRANSFER', 'Transferencia'


class ImmutablePaymentError(Exception):
    pass


class Bill(models.Model):
    table = models.ForeignKey(
        'tables.Table', on_delete=models.SET_NULL, null=True, blank=True, related_name='bills'
    )
    table_number = models.IntegerField()
    status = models.CharField(max_length=16, choices=BillStatus.choices, default=BillStatus.OPEN)
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='closed_bills',
    )
    subtotal = money_field(null=True, blank=True)
    tip_total = money_field(null=True, blank=True)
    total_paid = money_field(null=True, blank=True)
    payment_mode = models.CharField(max_length=16, choices=PaymentMode.choices, default=PaymentMode.POSTPAID)
    tax_type = models.CharField(max_length=8, choices=TaxType.choices, blank=True, default='')
    tax_rate = rate_field(null=True, blank=True)
    tax_base = money_field(null=True, blank=True)
    tax_amount = money_field(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['table'], condition=Q(status='OPEN'), name='unique_open_bill_per_table'
            ),
        ]
        permissions = [
            ('charge_bill', 'Puede cobrar cuentas'),
            ('view_payments', 'Puede ver el historial de pagos'),
        ]

    def __str__(self):
        return f'Cuenta {self.pk} - mesa {self.table_number}'


class Payment(models.Model):
    bill = models.ForeignKey(Bill, on_delete=models.PROTECT, related_name='payments')
    method = models.CharField(max_length=16, choices=PaymentMethod.choices)
    amount = money_field()
    tip = money_field(default=ZERO)
    reference = models.CharField(max_length=PAYMENT_REFERENCE_MAX_LENGTH, blank=True, default='')
    reverses = models.OneToOneField(
        'self', on_delete=models.PROTECT, null=True, blank=True, related_name='reversal'
    )
    reason = models.CharField(max_length=PAYMENT_REASON_MAX_LENGTH, blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=Q(reverses__isnull=True, amount__gt=0, tip__gte=0)
                | Q(reverses__isnull=False, amount__lt=0, tip__lte=0),
                name='payment_amount_sign_matches_type',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutablePaymentError('Los pagos no se pueden modificar; registra una anulación.')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Pago {self.pk} ({self.get_method_display()} {self.amount})'


class ImmutableCashClosingError(Exception):
    pass


class CashClosing(models.Model):
    """Daily cash count. The expected amounts are frozen when it is saved and never recalculated."""

    service_day = models.DateField()
    opening_float = money_field(default=ZERO)
    note = models.CharField(max_length=PAYMENT_REASON_MAX_LENGTH, blank=True, default='')
    closed_at = models.DateTimeField(default=timezone.now)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    voided_at = models.DateTimeField(null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    void_reason = models.CharField(max_length=PAYMENT_REASON_MAX_LENGTH, blank=True, default='')

    class Meta:
        ordering = ('-service_day', '-closed_at', '-id')
        constraints = [
            models.UniqueConstraint(
                fields=['service_day'], condition=Q(voided_at__isnull=True), name='one_cash_closing_per_day'
            ),
            models.CheckConstraint(check=Q(opening_float__gte=0), name='cash_closing_float_not_negative'),
        ]
        permissions = [('close_cash_register', 'Puede cerrar la caja')]

    def __str__(self):
        return f'Cierre de caja {self.service_day}'


class CashClosingLine(models.Model):
    closing = models.ForeignKey(CashClosing, on_delete=models.CASCADE, related_name='lines')
    method = models.CharField(max_length=16, choices=PaymentMethod.choices)
    expected = money_field()
    counted = money_field()
    difference = money_field()

    class Meta:
        ordering = ('id',)
        constraints = [
            models.UniqueConstraint(fields=['closing', 'method'], name='one_cash_closing_line_per_method'),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableCashClosingError('Los cierres de caja no se modifican; anula el cierre.')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.get_method_display()}: {self.difference}'
