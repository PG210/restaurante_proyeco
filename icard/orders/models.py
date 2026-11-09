from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

ORDER_TEXT_MAX_LENGTH = 255
MIN_ORDER_QUANTITY = 1


class OrderStatus(models.TextChoices):
    PENDING = 'PENDING', 'pending'
    PREPARING = 'PREPARING', 'preparing'
    READY = 'READY', 'ready'
    DELIVERED = 'DELIVERED', 'delivered'
    CANCELLED = 'CANCELLED', 'cancelled'


class Order(models.Model):
    table = models.ForeignKey('tables.Table', on_delete=models.SET_NULL, null=True, blank=True)
    product = models.ForeignKey('products.Product', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=255, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    quantity = models.PositiveIntegerField(
        default=MIN_ORDER_QUANTITY, validators=[MinValueValidator(MIN_ORDER_QUANTITY)]
    )
    notes = models.CharField(max_length=ORDER_TEXT_MAX_LENGTH, blank=True, default='')
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders'
    )
    cancel_reason = models.CharField(max_length=ORDER_TEXT_MAX_LENGTH, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    close = models.BooleanField(default=False)

    class Meta:
        permissions = [
            ('prepare_order', 'Puede preparar pedidos'),
            ('deliver_order', 'Puede marcar pedidos como entregados'),
            ('cancel_order', 'Puede cancelar pedidos'),
        ]

    def __str__(self):
        return str(self.table)
