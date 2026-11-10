import logging

from products.models import Product
from products.service_day import current_service_day

logger = logging.getLogger(__name__)


def set_availability(product: Product, is_available: bool, user) -> Product:
    product.sold_out_on = None if is_available else current_service_day()
    product.save(update_fields=['sold_out_on'])
    logger.info('Producto %s disponible=%s por usuario %s', product.pk, is_available, user.pk)
    return product


def restock_all(user) -> int:
    restocked = Product.objects.sold_out().update(sold_out_on=None)
    logger.info('Reposición de %s producto(s) por usuario %s', restocked, user.pk)
    return restocked
