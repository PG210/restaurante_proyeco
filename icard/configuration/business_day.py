"""Hour at which the restaurant's working day changes, read on almost every menu request.

It is cached so the menu does not query the settings once per product. Saving the settings
forgets the cached value; other processes without a shared cache pick it up within the TTL.
"""

from django.conf import settings
from django.core.cache import cache

from configuration.models import SETTINGS_ID, RestaurantSettings

BUSINESS_DAY_CACHE_KEY = 'configuration.business_day_start_hour'
BUSINESS_DAY_CACHE_SECONDS = 300


def business_day_start_hour() -> int:
    hour = cache.get(BUSINESS_DAY_CACHE_KEY)
    if hour is None:
        stored = (
            RestaurantSettings.objects.filter(pk=SETTINGS_ID)
            .values_list('business_day_start_hour', flat=True)
            .first()
        )
        hour = settings.BUSINESS_DAY_START_HOUR if stored is None else stored
        cache.set(BUSINESS_DAY_CACHE_KEY, hour, BUSINESS_DAY_CACHE_SECONDS)
    return hour


def forget_business_day_start_hour() -> None:
    cache.delete(BUSINESS_DAY_CACHE_KEY)
