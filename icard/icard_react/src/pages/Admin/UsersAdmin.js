import React, { useCallback, useEffect } from "react";
import { Loader } from "semantic-ui-react";
import { AddEditUSerForm, HeaderPage, TableUsers } from "../../components/Admin";
import { ModalBasic, TableFilters } from "../../components/Common";
import { useFormModal, useTableFilters, useUser } from "../../hooks";
import { ACTIVE_OPTIONS, ROLE_FILTER_OPTIONS, STAFF_OPTIONS, USER_FILTERS } from "../../utils/catalogFilters";
import { notifyError } from "../../utils/notify";

const USER_SELECTS = [
  { name: "role", label: "Rol", options: ROLE_FILTER_OPTIONS },
  { name: "active", label: "Activo", options: ACTIVE_OPTIONS },
  { name: "staff", label: "Staff", options: STAFF_OPTIONS },
];

export function UsersAdmin() {
  const { show, title, content, openModal, closeModal } = useFormModal();
  const { users, getUsers, deleteUser } = useUser();
  const userFilters = useTableFilters(users, USER_FILTERS);

  const loadUsers = useCallback(() => getUsers().catch(notifyError), [getUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const addUser = () => {
    openModal("Nuevo usuario", <AddEditUSerForm onClose={closeModal} onRefetch={loadUsers} />);
  };

  const updateUser = (user) => {
    openModal("Actualizar usuario", <AddEditUSerForm onClose={closeModal} onRefetch={loadUsers} user={user} />);
  };

  const onDeleteUser = async (user) => {
    if (!window.confirm(`¿Eliminar Usuario ${user.email}?`)) return;
    try {
      await deleteUser(user.id);
      loadUsers();
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <HeaderPage title="Usuarios" btnTitle="Nuevo usuario" btnClick={addUser} />

      {users === null ? (
        <Loader active inline="centered">
          Cargando ...
        </Loader>
      ) : (
        <>
          <TableFilters state={userFilters} selects={USER_SELECTS} searchPlaceholder="Buscar usuario" />
          <TableUsers users={userFilters.filtered} updateUser={updateUser} onDeleteUser={onDeleteUser} />
        </>
      )}

      <ModalBasic show={show} onClose={closeModal} title={title}>
        {content}
      </ModalBasic>
    </>
  );
}
