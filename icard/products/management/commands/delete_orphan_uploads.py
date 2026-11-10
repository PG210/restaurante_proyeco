from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from products.uploads import orphan_upload_names


class Command(BaseCommand):
    help = 'Borra las imágenes de productos y categorías a las que no apunta ningún registro.'

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Lista los archivos huérfanos sin borrarlos.',
        )

    def handle(self, *args, **options) -> None:
        orphans = orphan_upload_names()
        prefix = '[dry-run] ' if options['dry_run'] else ''
        for name in orphans:
            self.stdout.write(f'{prefix}{name}')
            if not options['dry_run']:
                default_storage.delete(name)

        verb = 'Se borrarían' if options['dry_run'] else 'Archivos borrados'
        self.stdout.write(self.style.SUCCESS(f'{verb}: {len(orphans)}.'))
