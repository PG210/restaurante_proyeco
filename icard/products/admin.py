from django.contrib import admin

from products.models import Allergen, Modifier, ModifierGroup, Product, StockMovement, Tag


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'price', 'active', 'stock', 'sold_out_on', 'position')
    list_filter = ('active', 'category', 'allergens_declared')
    filter_horizontal = ('modifier_groups', 'allergens', 'tags')
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


class ModifierInline(admin.TabularInline):
    model = Modifier
    extra = 0


@admin.register(ModifierGroup)
class ModifierGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'min_choices', 'max_choices', 'active', 'position')
    search_fields = ('name',)
    inlines = [ModifierInline]


@admin.register(Allergen, Tag)
class ProductLabelAdmin(admin.ModelAdmin):
    list_display = ('name', 'active', 'position')
    list_filter = ('active',)
    search_fields = ('name',)
