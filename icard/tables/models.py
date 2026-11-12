import uuid

from django.db import models


class Table(models.Model):
    number = models.IntegerField(unique=True)
    token = models.UUIDField(null=True, unique=True, editable=False)
    is_open = models.BooleanField(default=False)
    opened_at = models.DateTimeField(null=True, blank=True)
    bill_requested_at = models.DateTimeField(null=True, blank=True)
    waiter_called_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        permissions = [
            ('open_table', 'Puede abrir y cerrar mesas'),
            ('attend_bill_request', 'Puede atender pedidos de cuenta'),
        ]

    def save(self, *args, **kwargs):
        if self.token is None:
            self.token = uuid.uuid4()
            update_fields = kwargs.get('update_fields')
            if update_fields is not None:
                kwargs['update_fields'] = {*update_fields, 'token'}
        super().save(*args, **kwargs)

    @property
    def bill_requested(self) -> bool:
        return self.bill_requested_at is not None

    @property
    def waiter_called(self) -> bool:
        return self.waiter_called_at is not None

    def __str__(self):
        return str(self.number)
