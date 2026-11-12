"""The restaurant's working day ("jornada"): it starts at a configurable hour, not at midnight.

A sale at 1:00 belongs to the previous night. Stock, "Agotado hoy", the dashboard and the cash
closing all group by this day.
"""

import datetime
from dataclasses import dataclass
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone

from configuration.business_day import business_day_start_hour

ONE_DAY = datetime.timedelta(days=1)
ONE_WEEK = datetime.timedelta(days=7)


def business_zone() -> ZoneInfo:
    return ZoneInfo(settings.BUSINESS_TIME_ZONE)


def current_service_day(now: datetime.datetime | None = None) -> datetime.date:
    moment = (now or timezone.now()).astimezone(business_zone())
    return (moment - datetime.timedelta(hours=business_day_start_hour())).date()


def service_day_start(day: datetime.date) -> datetime.datetime:
    return datetime.datetime.combine(
        day, datetime.time(hour=business_day_start_hour()), tzinfo=business_zone()
    )


@dataclass(frozen=True)
class DayRange:
    """Service days from `first` (included) to `stop` (excluded)."""

    first: datetime.date
    stop: datetime.date

    def bounds(self) -> tuple[datetime.datetime, datetime.datetime]:
        return service_day_start(self.first), service_day_start(self.stop)


@dataclass(frozen=True)
class Period:
    current: DayRange
    previous: DayRange


def service_day_range(day: datetime.date) -> DayRange:
    return DayRange(day, day + ONE_DAY)


def dashboard_periods(today: datetime.date) -> dict[str, Period]:
    """Today, this week (since Monday) and this month, each against the same stretch before it.

    Ongoing periods are compared to date: Monday to Wednesday against last Monday to Wednesday,
    and the 1st to the 11th against the 1st to the 11th of last month.
    """
    tomorrow = today + ONE_DAY
    monday = today - datetime.timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    previous_month_start = (month_start - ONE_DAY).replace(day=1)
    previous_month_stop = min(previous_month_start + (tomorrow - month_start), month_start)
    return {
        'today': Period(DayRange(today, tomorrow), DayRange(today - ONE_WEEK, tomorrow - ONE_WEEK)),
        'week': Period(DayRange(monday, tomorrow), DayRange(monday - ONE_WEEK, tomorrow - ONE_WEEK)),
        'month': Period(DayRange(month_start, tomorrow), DayRange(previous_month_start, previous_month_stop)),
    }
