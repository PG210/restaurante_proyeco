from django.contrib import admin

from products.models import Product, StockMovement


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'price', 'active', 'stock', 'sold_out_on', 'position')
    list_filter = ('active', 'category')
    search_fields = ('title',)


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('product', 'change', 'stock_after', 'reason', 'service_day', 'created_by', 'created_at')
    list_filter = ('reason', 'service_day')

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
