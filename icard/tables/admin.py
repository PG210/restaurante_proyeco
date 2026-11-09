from django.contrib import admin

# Register your models here.
from tables.models import Table


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    pass
