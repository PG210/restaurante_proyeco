"""Daily cash closing ("cierre de caja").

The count is blind: whoever closes types what they counted without seeing what the system
expects, and only sees the difference once the closing is saved. That is why a missing note
does not block saving (it would reveal whether the count matches); it is added afterwards.
"""

import logging
from dataclasses import dataclass
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import F, Sum
from django.utils import timezone

from payments.models import ZERO, CashClosing, CashClosingLine, Payment, PaymentMethod
from payments.tax import to_money
from products.service_day import current_service_day, service_day_start
from users.models import User

logger = logging.getLogger(__name__)

ALREADY_CLOSED_MESSAGE = 'La caja de esta jornada ya está cerrada.'


class CashClosingError(Exception):
    pass


@dataclass(frozen=True)
class CashCount:
    opening_float: Decimal
    counted: dict[str, Decimal]
    note: str = ''


def expected_by_method(start, end) -> dict[str, Decimal]:
    """Payments plus tips received in [start, end), reversals subtracting."""
    rows = (
        Payment.objects.filter(created_at__gte=start, created_at__lt=end)
        .values('method')
        .annotate(total=Sum(F('amount') + F('tip')))
    )
    received = {row['method']: to_money(row['total']) for row in rows}
    return {method: received.get(method, ZERO) for method in PaymentMethod.values}


def todays_closing(now=None) -> CashClosing | None:
    day = current_service_day(now)
    return (
        CashClosing.objects.select_related('closed_by')
        .filter(service_day=day, voided_at__isnull=True)
        .first()
    )


def close_cash_register(count: CashCount, user: User, now=None) -> CashClosing:
    now = now or timezone.now()
    day = current_service_day(now)
    expected = expected_by_method(service_day_start(day), now)
    expected[PaymentMethod.CASH] += count.opening_float
    try:
        with transaction.atomic():
            if CashClosing.objects.filter(service_day=day, voided_at__isnull=True).exists():
                raise CashClosingError(ALREADY_CLOSED_MESSAGE)
            closing = CashClosing.objects.create(
                service_day=day,
                opening_float=count.opening_float,
                note=count.note.strip(),
                closed_at=now,
                closed_by=user,
            )
            CashClosingLine.objects.bulk_create(
                CashClosingLine(
                    closing=closing,
                    method=method,
                    expected=expected[method],
                    counted=count.counted[method],
                    difference=count.counted[method] - expected[method],
                )
                for method in PaymentMethod.values
            )
    except IntegrityError as error:
        raise CashClosingError(ALREADY_CLOSED_MESSAGE) from error
    logger.info('Caja de la jornada %s cerrada por %s.', day, user.pk)
    return closing


def add_closing_note(closing: CashClosing, note: str) -> CashClosing:
    with transaction.atomic():
        locked = CashClosing.objects.select_for_update().get(pk=closing.pk)
        if locked.voided_at is not None:
            raise CashClosingError('El cierre está anulado.')
        if locked.note:
            raise CashClosingError('El cierre ya tiene nota; no se puede cambiar.')
        locked.note = note.strip()
        locked.save(update_fields=['note'])
    return locked


def void_cash_closing(closing: CashClosing, reason: str, user: User) -> CashClosing:
    with transaction.atomic():
        locked = CashClosing.objects.select_for_update().get(pk=closing.pk)
        if locked.voided_at is not None:
            raise CashClosingError('El cierre ya está anulado.')
        locked.voided_at = timezone.now()
        locked.voided_by = user
        locked.void_reason = reason.strip()
        locked.save(update_fields=['voided_at', 'voided_by', 'void_reason'])
    logger.info('Cierre de caja %s anulado por %s: %s', locked.pk, user.pk, locked.void_reason)
    return locked
