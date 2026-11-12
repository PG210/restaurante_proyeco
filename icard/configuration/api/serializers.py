from decimal import Decimal

from rest_framework import serializers

from configuration.models import RATE_DECIMAL_PLACES, RATE_MAX_DIGITS, RestaurantSettings, SettingsChange
from configuration.services import EDITABLE_FIELDS
from payments.api.serializers import user_display_name

MINIMUM_RATE = Decimal('0.01')
MAXIMUM_RATE = Decimal('100')
TAX_RATE_FIELDS = {'charge_inc': 'inc_rate', 'charge_iva': 'iva_rate'}
EXCLUSIVE_TAXES_MESSAGE = (
    'El INC y el IVA no pueden estar activos a la vez. Desactiva uno antes de activar el otro.'
)


def rate_field() -> serializers.DecimalField:
    return serializers.DecimalField(
        max_digits=RATE_MAX_DIGITS,
        decimal_places=RATE_DECIMAL_PLACES,
        min_value=MINIMUM_RATE,
        max_value=MAXIMUM_RATE,
        allow_null=True,
        required=False,
    )


class RestaurantSettingsSerializer(serializers.ModelSerializer):
    inc_rate = rate_field()
    iva_rate = rate_field()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantSettings
        fields = [
            'charge_inc',
            'inc_rate',
            'charge_iva',
            'iva_rate',
            'payment_mode',
            'business_day_start_hour',
            'updated_at',
            'updated_by_name',
        ]
        read_only_fields = ['updated_at', 'updated_by_name']

    def get_updated_by_name(self, restaurant_settings: RestaurantSettings) -> str | None:
        return user_display_name(restaurant_settings.updated_by)

    def validate(self, attrs: dict) -> dict:
        merged = {field: attrs.get(field, getattr(self.instance, field)) for field in EDITABLE_FIELDS}
        if merged['charge_inc'] and merged['charge_iva']:
            raise serializers.ValidationError({'detail': EXCLUSIVE_TAXES_MESSAGE})
        errors = {
            rate_field_name: 'Indica la tarifa para activar este impuesto.'
            for flag, rate_field_name in TAX_RATE_FIELDS.items()
            if merged[flag] and merged[rate_field_name] is None
        }
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class SettingsChangeSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SettingsChange
        fields = ['id', 'field', 'old_value', 'new_value', 'changed_by_name', 'changed_at']
        read_only_fields = fields

    def get_changed_by_name(self, change: SettingsChange) -> str | None:
        return user_display_name(change.changed_by)
