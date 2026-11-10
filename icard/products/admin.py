from django.contrib import admin

from products.models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'price', 'active', 'sold_out_on', 'position')
    list_filter = ('active', 'category')
    search_fields = ('title',)
