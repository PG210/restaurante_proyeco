from django.core.management.base import BaseCommand

from icard.media import InvalidImageError
from products.uploads import needs_upload_optimization, optimize_upload, referenced_upload_names

BYTES_PER_KB = 1024


class Command(BaseCommand):
    help = (
        'Reduce a 1200 px, recomprime y quita los metadatos EXIF de las imágenes de productos y '
        'categorías. Sobrescribe los archivos: haz una copia de uploads/ antes.'
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Lista las imágenes que se optimizarían sin modificarlas.',
        )

    def handle(self, *args, **options) -> None:
        dry_run = options['dry_run']
        pending = [name for name in sorted(referenced_upload_names()) if self._needs_work(name)]

        if dry_run:
            for name in pending:
                self.stdout.write(f'[dry-run] {name}')
            self.stdout.write(self.style.SUCCESS(f'Se optimizarían: {len(pending)}.'))
            return

        for name in pending:
            result = optimize_upload(name)
            self.stdout.write(
                f'{name}: {result.bytes_before // BYTES_PER_KB} KB → {result.bytes_after // BYTES_PER_KB} KB'
            )
        self.stdout.write(self.style.SUCCESS(f'Imágenes optimizadas: {len(pending)}.'))

    def _needs_work(self, name: str) -> bool:
        try:
            return needs_upload_optimization(name)
        except FileNotFoundError:
            self.stderr.write(f'No existe el archivo {name}; se omite.')
        except InvalidImageError:
            self.stderr.write(f'{name} no es una imagen JPEG o PNG válida; se omite.')
        return False
