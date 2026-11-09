import React, { useCallback, useEffect } from "react";
import { Loader } from "semantic-ui-react";
import { AddEditUSerForm, HeaderPage, TableUsers } from "../../components/Admin";
import { ModalBasic } from "../../components/Common";
import { useFormModal, useUser } from "../../hooks";
import { notifyError } from "../../utils/notify";

export function UsersAdmin() {
  const { show, title, content, openModal, closeModal } = useFormModal();
  const { loading, users, getUsers, deleteUser } = useUser();

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

      {loading ? (
        <Loader active inline="centered">
          Cargando ...
        </Loader>
      ) : (
        <TableUsers users={users} updateUser={updateUser} onDeleteUser={onDeleteUser} />
      )}

      <ModalBasic show={show} onClose={closeModal} title={title}>
        {content}
      </ModalBasic>
    </>
  );
}
