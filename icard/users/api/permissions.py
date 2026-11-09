from rest_framework.permissions import SAFE_METHODS, BasePermission

from users.permissions import user_has_permission


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class HasActionPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        required_permission = view.action_permissions.get(view.action)
        if required_permission is None:
            return False
        return user_has_permission(request.user, required_permission)


def require_permission(permission: str) -> type[BasePermission]:
    class RequiredPermission(BasePermission):
        def has_permission(self, request, view) -> bool:
            return user_has_permission(request.user, permission)

    return RequiredPermission
