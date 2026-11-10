from django.db import models
from django.db.models import Q

from products.permissions import SET_PRODUCT_AVAILABILITY
from products.service_day import current_service_day


class ProductQuerySet(models.QuerySet):
    def sold_out(self) -> 'ProductQuerySet':
        return self.filter(sold_out_on__gte=current_service_day())

    def available(self) -> 'ProductQuerySet':
        return self.exclude(sold_out_on__gte=current_service_day())

    def in_visible_category(self) -> 'ProductQuerySet':
        return self.filter(Q(category__isnull=True) | Q(category__active=True))

    def orderable(self) -> 'ProductQuerySet':
        return self.available().in_visible_category().filter(active=True)


class Product(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    image = models.ImageField(upload_to='products')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    active = models.BooleanField(default=False)
    category = models.ForeignKey('categories.Category', on_delete=models.SET_NULL, null=True, blank=True)
    sold_out_on = models.DateField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ('position', 'title')
        permissions = [(SET_PRODUCT_AVAILABILITY, 'Puede marcar productos agotados')]

    def __str__(self):
        return self.title

    @property
    def is_available(self) -> bool:
        return self.sold_out_on is None or self.sold_out_on < current_service_day()
