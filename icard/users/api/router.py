from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from users.api.views import (
    LoginView,
    RolePermissionMatrixView,
    RolePermissionsView,
    UserApiViewSet,
    UserView,
)

router_user = DefaultRouter()

router_user.register(prefix='users', basename='users', viewset=UserApiViewSet)

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', UserView.as_view(), name='auth_me'),
    path('roles/permissions/', RolePermissionMatrixView.as_view(), name='role_permission_matrix'),
    path('roles/<str:role_name>/permissions/', RolePermissionsView.as_view(), name='role_permissions'),
]
