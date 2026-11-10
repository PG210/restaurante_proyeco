from django_filters import rest_framework as filters

from products.models import Product


class ProductFilter(filters.FilterSet):
    is_available = filters.BooleanFilter(method='filter_is_available')

    class Meta:
        model = Product
        fields = ['category', 'active']

    def filter_is_available(self, queryset, name, value):
        return queryset.available() if value else queryset.sold_out()
