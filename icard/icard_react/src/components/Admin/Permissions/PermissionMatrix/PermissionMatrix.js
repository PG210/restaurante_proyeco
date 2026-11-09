import React from "react";
import { Button, Checkbox, Table } from "semantic-ui-react";
import { draftFor, hasSamePermissions, togglePermission } from "../../../../utils/permissionMatrix";
import { ROLE_LABELS } from "../../../../utils/roles";

export function PermissionMatrix({ matrix, drafts, onChange, onSave, onRestoreDefaults, savingRole }) {
  return (
    <Table celled definition textAlign="center">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell />
          {matrix.roles.map((role) => (
            <Table.HeaderCell key={role.name}>{ROLE_LABELS[role.name] ?? role.name}</Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {matrix.permissions.map((permission) => (
          <Table.Row key={permission.codename}>
            <Table.Cell textAlign="left">{permission.label}</Table.Cell>
            {matrix.roles.map((role) => (
              <Table.Cell key={role.name}>
                <Checkbox
                  aria-label={`${permission.label} - ${role.name}`}
                  checked={draftFor(drafts, role).includes(permission.codename)}
                  onChange={() => onChange(role.name, togglePermission(draftFor(drafts, role), permission.codename))}
                />
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>

      <Table.Footer>
        <Table.Row>
          <Table.HeaderCell />
          {matrix.roles.map((role) => (
            <Table.HeaderCell key={role.name}>
              <Button
                primary
                size="small"
                disabled={hasSamePermissions(draftFor(drafts, role), role.permissions)}
                loading={savingRole === role.name}
                onClick={() => onSave(role.name)}
              >
                Guardar
              </Button>
              <Button
                basic
                size="small"
                disabled={hasSamePermissions(draftFor(drafts, role), role.defaults)}
                onClick={() => onRestoreDefaults(role)}
              >
                Restaurar
              </Button>
            </Table.HeaderCell>
          ))}
        </Table.Row>
      </Table.Footer>
    </Table>
  );
}
