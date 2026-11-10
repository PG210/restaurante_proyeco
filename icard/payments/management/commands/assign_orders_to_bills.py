from django.core.management.base import BaseCommand
from django.db import transaction

from orders.models import Order
from payments.services import get_or_create_open_bill
from tables.models import Table


class Command(BaseCommand):
    help = 'Crea una cuenta abierta por mesa para los pedidos abiertos que todavía no tienen cuenta.'

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra cuántos pedidos y mesas se actualizarían sin escribir en la base de datos.',
        )

    def handle(self, *args, **options) -> None:
        unbilled_orders = Order.objects.filter(close=False, bill__isnull=True, table__isnull=False)
        table_ids = sorted(set(unbilled_orders.values_list('table_id', flat=True)))
        order_count = unbilled_orders.count()

        if options['dry_run']:
            self.stdout.write(f'[dry-run] Pedidos sin cuenta: {order_count} en {len(table_ids)} mesa(s).')
            return

        with transaction.atomic():
            for table in Table.objects.filter(pk__in=table_ids):
                bill = get_or_create_open_bill(table)
                unbilled_orders.filter(table=table).update(bill=bill)
        self.stdout.write(
            self.style.SUCCESS(f'Pedidos asignados: {order_count} en {len(table_ids)} mesa(s).')
        )
