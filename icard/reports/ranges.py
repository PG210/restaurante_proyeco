"""The date range of a report, in service days (both ends included)."""

import datetime
from dataclasses import dataclass

from products.service_day import ONE_DAY, DayRange

DEFAULT_RANGE_DAYS = 7
MAX_RANGE_DAYS = 366

INVERTED_RANGE_MESSAGE = 'La fecha "desde" no puede ser posterior a "hasta".'
RANGE_TOO_LONG_MESSAGE = f'El rango no puede superar {MAX_RANGE_DAYS} días.'


class ReportRangeError(ValueError):
    pass


@dataclass(frozen=True)
class ReportRange:
    first: datetime.date
    last: datetime.date

    @property
    def days(self) -> DayRange:
        return DayRange(self.first, self.last + ONE_DAY)

    def bounds(self) -> tuple[datetime.datetime, datetime.datetime]:
        return self.days.bounds()


def report_range(
    today: datetime.date, first: datetime.date | None = None, last: datetime.date | None = None
) -> ReportRange:
    """Builds the range; a missing end defaults to today, a missing start to a week before the end."""
    last = last or today
    first = first or last - datetime.timedelta(days=DEFAULT_RANGE_DAYS - 1)
    if first > last:
        raise ReportRangeError(INVERTED_RANGE_MESSAGE)
    if (last - first).days + 1 > MAX_RANGE_DAYS:
        raise ReportRangeError(RANGE_TOO_LONG_MESSAGE)
    return ReportRange(first, last)
