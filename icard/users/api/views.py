from django.contrib.auth.models import Group
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework_simplejwt.views import TokenObtainPairView

from users.api.serializers import MeSerializer, RolePermissionsUpdateSerializer, UserSerializer
from users.models import User
from users.roles import STAFF_ROLES
from users.services import MissingPermissionsError, get_permission_matrix, set_role_permissions

LOGIN_THROTTLE_SCOPE = 'login'


class PermissionsNotConfigured(APIException):
    status_code = 503
    default_detail = 'Los permisos no están configurados. Contacta al administrador.'
    default_code = 'permissions_not_configured'


class LoginView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = LOGIN_THROTTLE_SCOPE


class UserApiViewSet(ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = UserSerializer
    queryset = User.objects.prefetch_related('groups').order_by('id')


class UserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)


class RolePermissionMatrixView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(get_permission_matrix())


class RolePermissionsView(APIView):
    permission_classes = [IsAdminUser]

    def put(self, request, role_name: str):
        group = get_object_or_404(Group, name=role_name, name__in=STAFF_ROLES)
        serializer = RolePermissionsUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            set_role_permissions(group, serializer.validated_data['permissions'])
        except MissingPermissionsError as error:
            raise PermissionsNotConfigured() from error
        return Response({'name': group.name, 'permissions': serializer.validated_data['permissions']})
