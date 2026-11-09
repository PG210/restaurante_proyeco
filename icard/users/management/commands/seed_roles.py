from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError

from users.roles import STAFF_ROLES
from users.services import (
    MissingPermissionsError,
    RolePermissionChange,
    apply_default_permissions,
    plan_default_permissions,
)


class Command(BaseCommand):
    help = (
        'Crea los grupos de roles que falten y les asigna los permisos por defecto que falten. '
        'No quita permisos delegados salvo con --reset.'
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra los cambios sin escribir en la base de datos.',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Deja cada rol exactamente con los permisos por defecto.',
        )

    def handle(self, *args, **options) -> None:
        dry_run = options['dry_run']
        missing_roles = self._missing_roles()
        self._report_roles(missing_roles, dry_run)

        if dry_run and missing_roles:
            self.stdout.write('Los permisos de los roles nuevos se asignarán al ejecutar sin --dry-run.')
        if not dry_run:
            Group.objects.bulk_create([Group(name=role) for role in missing_roles])

        try:
            changes = plan_default_permissions(reset=options['reset'])
        except MissingPermissionsError as error:
            raise CommandError(str(error)) from error

        self._report_permissions(changes, dry_run)
        if not dry_run:
            apply_default_permissions(changes)

    @staticmethod
    def _missing_roles() -> list[str]:
        existing_roles = set(Group.objects.filter(name__in=STAFF_ROLES).values_list('name', flat=True))
        return [role for role in STAFF_ROLES if role not in existing_roles]

    def _report_roles(self, missing_roles: list[str], dry_run: bool) -> None:
        if not missing_roles:
            self.stdout.write('Todos los roles ya existen.')
            return
        verb = 'Se crearían' if dry_run else 'Roles creados'
        self.stdout.write(f'{verb}: {", ".join(missing_roles)}')

    def _report_permissions(self, changes: list[RolePermissionChange], dry_run: bool) -> None:
        pending_changes = [change for change in changes if change.has_changes]
        if not pending_changes:
            self.stdout.write('Los permisos de los roles ya están al día.')
            return
        prefix = '[dry-run] ' if dry_run else ''
        for change in pending_changes:
            self.stdout.write(
                f'{prefix}{change.role}: añadir {list(change.added)}, quitar {list(change.removed)}'
            )
