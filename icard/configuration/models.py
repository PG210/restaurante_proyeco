from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models
from django.db.models import Q

SETTINGS_ID = 1
RATE_MAX_DIGITS = 5
RATE_DECIMAL_PLACES = 2
SETTINGS_FIELD_MAX_LENGTH = 32
SETTINGS_VALUE_MAX_LENGTH = 64
LAST_HOUR_OF_DAY = 23


class PaymentMode(models.TextChoices):
    POSTPAID = 'POSTPAID', 'Al final'
    PREPAID = 'PREPAID', 'Anticipado'


class TaxType(models.TextChoices):
    INC = 'INC', 'INC'
    IVA = 'IVA', 'IVA'


class ImmutableSettingsChangeError(Exception):
    pass


def rate_field(**kwargs) -> models.DecimalField:
    return models.DecimalField(max_digits=RATE_MAX_DIGITS, decimal_places=RATE_DECIMAL_PLACES, **kwargs)


def _valid_rate(prefix: str) -> Q:
    return Q(**{f'charge_{prefix}': False}) | Q(
        **{f'{prefix}_rate__isnull': False, f'{prefix}_rate__gt': 0, f'{prefix}_rate__lte': 100}
    )


def default_business_day_start_hour() -> int:
    return settings.BUSINESS_DAY_START_HOUR


class RestaurantSettings(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=SETTINGS_ID, editable=False)
    charge_inc = models.BooleanField(default=False)
    inc_rate = rate_field(null=True, blank=True)
    charge_iva = models.BooleanField(default=False)
    iva_rate = rate_field(null=True, blank=True)
    payment_mode = models.CharField(max_length=16, choices=PaymentMode.choices, default=PaymentMode.POSTPAID)
    business_day_start_hour = models.PositiveSmallIntegerField(
        default=default_business_day_start_hour, validators=[MaxValueValidator(LAST_HOUR_OF_DAY)]
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )

    class Meta:
        constraints = [
            models.CheckConstraint(check=Q(id=SETTINGS_ID), name='single_restaurant_settings_row'),
            models.CheckConstraint(check=~Q(charge_inc=True, charge_iva=True), name='inc_and_iva_exclusive'),
            models.CheckConstraint(check=_valid_rate('inc'), name='inc_rate_required_when_active'),
            models.CheckConstraint(check=_valid_rate('iva'), name='iva_rate_required_when_active'),
        ]

    def active_tax(self) -> tuple[str, Decimal] | None:
        if self.charge_inc:
            return TaxType.INC, self.inc_rate
        if self.charge_iva:
            return TaxType.IVA, self.iva_rate
        return None


class SettingsChange(models.Model):
    field = models.CharField(max_length=SETTINGS_FIELD_MAX_LENGTH)
    old_value = models.CharField(max_length=SETTINGS_VALUE_MAX_LENGTH, blank=True, default='')
    new_value = models.CharField(max_length=SETTINGS_VALUE_MAX_LENGTH, blank=True, default='')
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at', '-id']

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableSettingsChangeError('El historial de configuración no se puede modificar.')
        super().save(*args, **kwargs)
