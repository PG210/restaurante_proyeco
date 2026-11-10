from django.contrib import admin

from categories.models import Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'active', 'position')
    list_filter = ('active',)
    search_fields = ('title',)
