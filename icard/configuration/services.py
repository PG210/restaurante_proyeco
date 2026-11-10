import logging

from django.db import transaction

from configuration.models import SETTINGS_ID, RestaurantSettings, SettingsChange
from payments.models import Bill, BillStatus
from users.models import User

logger = logging.getLogger(__name__)

EDITABLE_FIELDS = ('charge_inc', 'inc_rate', 'charge_iva', 'iva_rate', 'payment_mode')


class SettingsConflictError(Exception):
    pass


def get_settings() -> RestaurantSettings:
    restaurant_settings, _ = RestaurantSettings.objects.get_or_create(pk=SETTINGS_ID)
    return restaurant_settings


def _as_text(value) -> str:
    return '' if value is None else str(value)


def update_settings(changes: dict, user: User) -> RestaurantSettings:
    with transaction.atomic():
        get_settings()
        locked = RestaurantSettings.objects.select_for_update().get(pk=SETTINGS_ID)
        changed = {
            field: value
            for field, value in changes.items()
            if field in EDITABLE_FIELDS and _as_text(getattr(locked, field)) != _as_text(value)
        }
        if 'payment_mode' in changed and Bill.objects.filter(status=BillStatus.OPEN).exists():
            raise SettingsConflictError(
                'Hay cuentas abiertas. Cóbralas o ciérralas antes de cambiar el momento de cobro.'
            )
        history = [
            SettingsChange(
                field=field,
                old_value=_as_text(getattr(locked, field)),
                new_value=_as_text(value),
                changed_by=user,
            )
            for field, value in changed.items()
        ]
        for field, value in changed.items():
            setattr(locked, field, value)
        locked.updated_by = user
        locked.save()
        SettingsChange.objects.bulk_create(history)
    for change in history:
        logger.info('Configuración %s: %s -> %s.', change.field, change.old_value, change.new_value)
    return locked
