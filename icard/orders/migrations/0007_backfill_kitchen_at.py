from django.db import migrations
from django.db.models import F

AWAITING_PAYMENT = 'AWAITING_PAYMENT'


def backfill_kitchen_at(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    Order.objects.filter(kitchen_at__isnull=True).exclude(status=AWAITING_PAYMENT).update(
        kitchen_at=F('created_at')
    )


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0006_order_kitchen_at_order_preparation_minutes'),
    ]

    operations = [
        migrations.RunPython(backfill_kitchen_at, migrations.RunPython.noop),
    ]
