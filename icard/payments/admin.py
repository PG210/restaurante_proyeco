from django.contrib import admin

from payments.models import Bill, Payment


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


@admin.register(Bill)
class BillAdmin(ReadOnlyAdmin):
    list_display = ['id', 'table_number', 'status', 'opened_at', 'closed_at', 'total_paid']


@admin.register(Payment)
class PaymentAdmin(ReadOnlyAdmin):
    list_display = ['id', 'bill', 'method', 'amount', 'tip', 'created_at']
