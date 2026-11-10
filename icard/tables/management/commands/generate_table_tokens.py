import uuid

from django.core.management.base import BaseCommand
from django.db import transaction

from tables.models import Table


class Command(BaseCommand):
    help = 'Asigna un token de QR distinto a cada mesa que todavía no tiene uno.'

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra cuántas mesas se actualizarían sin escribir en la base de datos.',
        )

    def handle(self, *args, **options) -> None:
        tables_without_token = list(Table.objects.filter(token__isnull=True).order_by('number'))

        if options['dry_run']:
            self.stdout.write(f'[dry-run] Mesas sin token: {len(tables_without_token)}.')
            return

        for table in tables_without_token:
            table.token = uuid.uuid4()
        with transaction.atomic():
            Table.objects.bulk_update(tables_without_token, ['token'])
        self.stdout.write(self.style.SUCCESS(f'Tokens generados: {len(tables_without_token)}.'))
