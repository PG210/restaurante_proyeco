import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone


def current_service_day(now: datetime.datetime | None = None) -> datetime.date:
    moment = (now or timezone.now()).astimezone(ZoneInfo(settings.BUSINESS_TIME_ZONE))
    return (moment - datetime.timedelta(hours=settings.BUSINESS_DAY_START_HOUR)).date()
