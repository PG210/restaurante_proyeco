from django_filters import rest_framework as filters

from orders.models import Order


class OrderFilter(filters.FilterSet):
    created_at_after = filters.IsoDateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_at_before = filters.IsoDateTimeFilter(field_name='created_at', lookup_expr='lte')

    class Meta:
        model = Order
        fields = {
            'status': ['exact', 'in'],
            'table': ['exact'],
            'product': ['exact'],
            'close': ['exact'],
            'created_by': ['isnull'],
        }
