def user_has_permission(user, permission: str) -> bool:
    if not (user and user.is_authenticated):
        return False
    return user.is_staff or user.has_perm(permission)
