from rest_framework.permissions import SAFE_METHODS, BasePermission

from users.permissions import user_has_permission


def _user_has_any(user, permissions: str | tuple[str, ...]) -> bool:
    required = (permissions,) if isinstance(permissions, str) else permissions
    return any(user_has_permission(user, permission) for permission in required)


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class HasActionPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        required_permissions = view.action_permissions.get(view.action)
        if required_permissions is None:
            return False
        return _user_has_any(request.user, required_permissions)


def require_permission(permission: str) -> type[BasePermission]:
    class RequiredPermission(BasePermission):
        def has_permission(self, request, view) -> bool:
            return user_has_permission(request.user, permission)

    return RequiredPermission
