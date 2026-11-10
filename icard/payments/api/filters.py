from django_filters import rest_framework as filters

from payments.models import Bill, PaymentMethod


class BillFilter(filters.FilterSet):
    closed_at_after = filters.IsoDateTimeFilter(field_name='closed_at', lookup_expr='gte')
    closed_at_before = filters.IsoDateTimeFilter(field_name='closed_at', lookup_expr='lte')
    method = filters.ChoiceFilter(field_name='payments__method', choices=PaymentMethod.choices, distinct=True)

    class Meta:
        model = Bill
        fields = {
            'status': ['exact'],
            'table_number': ['exact'],
        }
