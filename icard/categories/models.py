from django.db import models


class Category(models.Model):
    title = models.CharField(max_length=100)
    image = models.ImageField(upload_to='categories')
    active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ('position', 'title')

    def __str__(self):
        return self.title
