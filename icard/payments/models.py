from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import Q

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
