from django.db.models import F
from django_filters import rest_framework as filters

from products.models import Product


class ProductFilter(filters.FilterSet):
    is_available = filters.BooleanFilter(method='filter_is_available')
    low_stock = filters.BooleanFilter(method='filter_low_stock')

    class Meta:
        model = Product
        fields = ['category', 'active', 'allergens_declared']

    def filter_is_available(self, queryset, name, value):
        return queryset.available() if value else queryset.sold_out()

    def filter_low_stock(self, queryset, name, value):
        low = queryset.stock_tracked().filter(
            low_stock_threshold__isnull=False, stock__lte=F('low_stock_threshold')
        )
        return low if value else queryset.exclude(pk__in=low.values('pk'))
