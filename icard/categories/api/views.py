from rest_framework.throttling import AnonRateThrottle
from rest_framework.viewsets import ModelViewSet

from categories.api.serializers import CategorySerializer
from categories.models import Category
from users.api.permissions import IsAdminOrReadOnly


class CategoryApiViewSet(ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]
    throttle_classes = [AnonRateThrottle]
    serializer_class = CategorySerializer
    queryset = Category.objects.all()
