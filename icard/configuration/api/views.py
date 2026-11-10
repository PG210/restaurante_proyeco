from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import SAFE_METHODS, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from configuration.api.serializers import RestaurantSettingsSerializer, SettingsChangeSerializer
from configuration.models import SettingsChange
from configuration.services import SettingsConflictError, get_settings, update_settings

CHANGES_PAGE_SIZE = 50


class SettingsChangesPagination(PageNumberPagination):
    page_size = CHANGES_PAGE_SIZE


class RestaurantSettingsView(APIView):
    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def get(self, request):
        return Response(RestaurantSettingsSerializer(get_settings()).data)

    def patch(self, request):
        serializer = RestaurantSettingsSerializer(get_settings(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            updated = update_settings(serializer.validated_data, request.user)
        except SettingsConflictError as error:
            raise ValidationError({'detail': str(error)}) from error
        return Response(RestaurantSettingsSerializer(updated).data)


class SettingsChangeListView(ListAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = SettingsChangeSerializer
    pagination_class = SettingsChangesPagination
    queryset = SettingsChange.objects.select_related('changed_by')
