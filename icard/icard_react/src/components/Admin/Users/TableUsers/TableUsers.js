import React from "react";
import { Button, Icon, Table } from "semantic-ui-react";
import "./TableUsers.scss";
import { formatRoles } from "../../../../utils/roles";

export function TableUsers({ users, updateUser, onDeleteUser }) {
  return (
    <Table className="table-users-admin">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Username</Table.HeaderCell>
          <Table.HeaderCell>Email</Table.HeaderCell>
          <Table.HeaderCell>Nombre</Table.HeaderCell>
          <Table.HeaderCell>Apellidos</Table.HeaderCell>
          <Table.HeaderCell>Roles</Table.HeaderCell>
          <Table.HeaderCell>Activo</Table.HeaderCell>
          <Table.HeaderCell>Staff</Table.HeaderCell>
          <Table.HeaderCell></Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {(users || []).map((user) => (
          <Table.Row key={user.id}>
            <Table.Cell>{user.username}</Table.Cell>
            <Table.Cell>{user.email}</Table.Cell>
            <Table.Cell>{user.first_name}</Table.Cell>
            <Table.Cell>{user.last_name}</Table.Cell>
            <Table.Cell>{formatRoles(user.roles)}</Table.Cell>
            <Table.Cell className="status">
              <Icon name={user.is_active ? "check" : "close"} />
            </Table.Cell>
            <Table.Cell className="status">
              <Icon name={user.is_staff ? "check" : "close"} />
            </Table.Cell>
            <Actions user={user} updateUser={updateUser} onDeleteUser={onDeleteUser} />
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function Actions({ user, updateUser, onDeleteUser }) {
  return (
    <Table.Cell textAlign="right">
      <Button icon onClick={() => updateUser(user)}>
        <Icon name="pencil" />
      </Button>
      <Button icon negative onClick={() => onDeleteUser(user)}>
        <Icon name="close" />
      </Button>
    </Table.Cell>
  );
}
