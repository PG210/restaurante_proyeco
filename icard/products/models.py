from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from products.permissions import MANAGE_STOCK, SET_PRODUCT_AVAILABILITY
from products.service_day import current_service_day

STOCK_NOTE_MAX_LENGTH = 255
MODIFIER_NAME_MAX_LENGTH = 100
MIN_MAX_CHOICES = 1


class ProductQuerySet(models.QuerySet):
    def sold_out(self) -> 'ProductQuerySet':
        return self.filter(Q(sold_out_on__gte=current_service_day()) | Q(stock=0))

    def available(self) -> 'ProductQuerySet':
        return self.exclude(sold_out_on__gte=current_service_day()).exclude(stock=0)

    def in_visible_category(self) -> 'ProductQuerySet':
        return self.filter(Q(category__isnull=True) | Q(category__active=True))

    def orderable(self) -> 'ProductQuerySet':
        return self.available().in_visible_category().filter(active=True)

    def stock_tracked(self) -> 'ProductQuerySet':
        return self.filter(stock__isnull=False)


class Product(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to='products')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    active = models.BooleanField(default=False)
    category = models.ForeignKey('categories.Category', on_delete=models.SET_NULL, null=True, blank=True)
    sold_out_on = models.DateField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    stock = models.PositiveIntegerField(null=True, blank=True)
    low_stock_threshold = models.PositiveIntegerField(null=True, blank=True)
    modifier_groups = models.ManyToManyField('products.ModifierGroup', blank=True, related_name='products')

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ('position', 'title')
        permissions = [
            (SET_PRODUCT_AVAILABILITY, 'Puede marcar productos agotados'),
            (MANAGE_STOCK, 'Puede reponer y ajustar el stock'),
        ]
        constraints = [
            models.CheckConstraint(
                check=Q(stock__isnull=True) | Q(stock__gte=0), name='product_stock_not_negative'
            ),
        ]

    def __str__(self):
        return self.title

    @property
    def tracks_stock(self) -> bool:
        return self.stock is not None

    @property
    def is_sold_out_today(self) -> bool:
        return self.sold_out_on is not None and self.sold_out_on >= current_service_day()

    @property
    def is_available(self) -> bool:
        return not self.is_sold_out_today and self.stock != 0

    @property
    def is_low_stock(self) -> bool:
        if not self.tracks_stock or self.low_stock_threshold is None:
            return False
        return self.stock <= self.low_stock_threshold


class StockReason(models.TextChoices):
    ORDER = 'ORDER', 'Pedido'
    CANCEL = 'CANCEL', 'Cancelación'
    ORDER_EDIT = 'ORDER_EDIT', 'Cambio de cantidad'
    RESTOCK = 'RESTOCK', 'Reposición'
    ADJUST = 'ADJUST', 'Ajuste'


class ImmutableStockMovementError(Exception):
    pass


class StockMovement(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_movements')
    change = models.IntegerField()
    stock_after = models.PositiveIntegerField(null=True, blank=True)
    reason = models.CharField(max_length=20, choices=StockReason.choices)
    order = models.ForeignKey(
        'orders.Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements'
    )
    note = models.CharField(max_length=STOCK_NOTE_MAX_LENGTH, blank=True, default='')
    service_day = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at', '-id')
        indexes = [models.Index(fields=['product', 'service_day'])]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableStockMovementError('Los movimientos de stock no se modifican.')
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableStockMovementError('Los movimientos de stock no se borran.')

    def __str__(self):
        return f'{self.product} {self.change:+d} ({self.get_reason_display()})'


class ModifierGroup(models.Model):
    name = models.CharField(max_length=MODIFIER_NAME_MAX_LENGTH)
    min_choices = models.PositiveIntegerField(default=0)
    max_choices = models.PositiveIntegerField(default=1, validators=[MinValueValidator(MIN_MAX_CHOICES)])
    active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ('position', 'name', 'id')
        constraints = [
            models.CheckConstraint(
                check=Q(max_choices__gte=MIN_MAX_CHOICES) & Q(max_choices__gte=models.F('min_choices')),
                name='modifier_group_choices_range',
            ),
        ]

    def __str__(self):
        return self.name


class Modifier(models.Model):
    group = models.ForeignKey(ModifierGroup, on_delete=models.CASCADE, related_name='modifiers')
    name = models.CharField(max_length=MODIFIER_NAME_MAX_LENGTH)
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ('position', 'name', 'id')
        constraints = [
            models.CheckConstraint(check=Q(price_delta__gte=0), name='modifier_price_not_negative'),
        ]

    def __str__(self):
        return f'{self.group}: {self.name}'
