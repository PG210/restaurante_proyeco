import logging
from dataclasses import dataclass

from django.contrib.auth.models import Group, Permission
from django.db import transaction
from django.db.models import QuerySet

from users.models import User
from users.roles import (
    DEFAULT_ROLE_PERMISSIONS,
    DELEGABLE_PERMISSIONS,
    PERMISSION_APP_LABELS,
    PERMISSION_LABELS,
    STAFF_ROLES,
    qualified_delegable_permission,
)

logger = logging.getLogger(__name__)


class MissingPermissionsError(Exception):
    pass


@dataclass(frozen=True)
class RolePermissionChange:
    role: str
    added: tuple[str, ...]
    removed: tuple[str, ...]

    @property
    def has_changes(self) -> bool:
        return bool(self.added or self.removed)


def get_delegable_permissions() -> dict[str, Permission]:
    permissions = _delegable_permission_queryset(Permission.objects.select_related('content_type'))
    permissions_by_codename = {
        permission.codename: permission
        for permission in permissions
        if _is_delegable(permission.codename, permission.content_type.app_label)
    }
    missing = sorted(set(DELEGABLE_PERMISSIONS) - permissions_by_codename.keys())
    if missing:
        raise MissingPermissionsError(
            f'Faltan permisos en la base de datos: {", ".join(missing)}. Ejecuta "manage.py migrate".'
        )
    return permissions_by_codename


def get_user_permissions(user: User) -> list[str]:
    if user.is_staff:
        return list(DELEGABLE_PERMISSIONS)
    return [
        codename
        for codename in DELEGABLE_PERMISSIONS
        if user.has_perm(qualified_delegable_permission(codename))
    ]


def get_permission_matrix() -> dict:
    groups = Group.objects.filter(name__in=STAFF_ROLES)
    granted_by_role = {group.name: _delegable_codenames(group) for group in groups}
    return {
        'permissions': [
            {'codename': codename, 'label': PERMISSION_LABELS[codename]} for codename in DELEGABLE_PERMISSIONS
        ],
        'roles': [
            {
                'name': role,
                'permissions': sorted(granted_by_role[role]),
                'defaults': sorted(DEFAULT_ROLE_PERMISSIONS[role]),
            }
            for role in STAFF_ROLES
            if role in granted_by_role
        ],
    }


def set_role_permissions(group: Group, codenames: list[str]) -> RolePermissionChange:
    change = _diff(group, set(codenames))
    with transaction.atomic():
        _apply(group, change)
    logger.info(
        'Permisos del rol %s actualizados. Añadidos: %s. Quitados: %s.',
        group.name,
        change.added,
        change.removed,
    )
    return change


def plan_default_permissions(reset: bool) -> list[RolePermissionChange]:
    get_delegable_permissions()
    groups = Group.objects.filter(name__in=STAFF_ROLES)
    changes = []
    for group in groups:
        default_codenames = set(DEFAULT_ROLE_PERMISSIONS[group.name])
        target = default_codenames if reset else default_codenames | _delegable_codenames(group)
        changes.append(_diff(group, target))
    return changes


def apply_default_permissions(changes: list[RolePermissionChange]) -> None:
    groups_by_name = {group.name: group for group in Group.objects.filter(name__in=STAFF_ROLES)}
    with transaction.atomic():
        for change in changes:
            _apply(groups_by_name[change.role], change)


def _delegable_permission_queryset(queryset: QuerySet) -> QuerySet:
    return queryset.filter(
        codename__in=DELEGABLE_PERMISSIONS, content_type__app_label__in=set(PERMISSION_APP_LABELS.values())
    )


def _is_delegable(codename: str, app_label: str) -> bool:
    return PERMISSION_APP_LABELS.get(codename) == app_label


def _delegable_codenames(group: Group) -> set[str]:
    granted = _delegable_permission_queryset(group.permissions.all()).values_list(
        'codename', 'content_type__app_label'
    )
    return {codename for codename, app_label in granted if _is_delegable(codename, app_label)}


def _diff(group: Group, target: set[str]) -> RolePermissionChange:
    current = _delegable_codenames(group)
    return RolePermissionChange(
        role=group.name, added=tuple(sorted(target - current)), removed=tuple(sorted(current - target))
    )


def _apply(group: Group, change: RolePermissionChange) -> None:
    permissions = get_delegable_permissions()
    group.permissions.add(*(permissions[codename] for codename in change.added))
    group.permissions.remove(*(permissions[codename] for codename in change.removed))
