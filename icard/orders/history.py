"""The status history of orders, written in the same transaction as each change."""

import datetime
from collections.abc import Iterable

from django.utils import timezone

from orders.models import OrderStatusChange
from users.models import User

NEW_ORDER = ''


def record_status_changes(
    changes: Iterable[tuple[int, str]],
    to_status: str,
    user: User | None,
    at: datetime.datetime | None = None,
) -> None:
    """Records `(order_id, from_status)` pairs moving to `to_status`.

    Orders changed together share the same time.
    """
    at = at or timezone.now()
    changed_by = user if user is not None and user.is_authenticated else None
    OrderStatusChange.objects.bulk_create(
        OrderStatusChange(
            order_id=order_id,
            from_status=from_status,
            to_status=to_status,
            changed_at=at,
            changed_by=changed_by,
        )
        for order_id, from_status in changes
    )
