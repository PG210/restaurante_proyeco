from django.core.management.base import BaseCommand
from django.db.models import OuterRef, Subquery

from orders.models import Order
from products.models import Product


class Command(BaseCommand):
    help = 'Asigna el precio actual del producto a los pedidos que no tienen precio.'

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra cuántos pedidos se actualizarían sin escribir en la base de datos.',
        )

    def handle(self, *args, **options) -> None:
        orders_without_price = Order.objects.filter(price__isnull=True)
        fillable_orders = orders_without_price.filter(product__isnull=False)
        skipped_count = orders_without_price.filter(product__isnull=True).count()

        if options['dry_run']:
            self.stdout.write(
                f'[dry-run] Se actualizarían {fillable_orders.count()} pedidos. '
                f'Sin producto (se omiten): {skipped_count}.'
            )
            return

        product_price = Product.objects.filter(pk=OuterRef('product_id')).values('price')[:1]
        updated_count = fillable_orders.update(price=Subquery(product_price))
        self.stdout.write(
            self.style.SUCCESS(
                f'Pedidos actualizados: {updated_count}. Sin producto (se omiten): {skipped_count}.'
            )
        )
