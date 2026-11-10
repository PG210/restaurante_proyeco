from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.throttling import AnonRateThrottle
from rest_framework.viewsets import ModelViewSet

from categories.api.serializers import CategorySerializer
from categories.models import Category
from icard.media import ImageCleanupMixin
from users.api.permissions import IsAdminOrReadOnly


class CategoryApiViewSet(ImageCleanupMixin, ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    throttle_classes = [AnonRateThrottle]
    serializer_class = CategorySerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['active']

    def get_queryset(self):
        if self.request.user.is_staff:
            return Category.objects.all()
        return Category.objects.filter(active=True)
