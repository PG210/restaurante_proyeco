import React, { useCallback, useEffect } from "react";
import { Loader } from "semantic-ui-react";
import { AddEditTableForm, HeaderPage, TableTablesAdmin } from "../../components/Admin";
import { ModalBasic } from "../../components/Common";
import { useFormModal, useTable } from "../../hooks";
import { notifyError } from "../../utils/notify";

export function TablesAdmin() {
  const { show, title, content, openModal, closeModal } = useFormModal();
  const { loading, tables, getTables, deleteTable } = useTable();

  const loadTables = useCallback(() => getTables().catch(notifyError), [getTables]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const addTable = () => {
    openModal("Nueva mesa", <AddEditTableForm onClose={closeModal} onRefetch={loadTables} />);
  };

  const updateTable = (table) => {
    openModal("Actualizar mesa", <AddEditTableForm onClose={closeModal} onRefetch={loadTables} table={table} />);
  };

  const onDeleteTable = async (table) => {
    if (!window.confirm(`¿Estás seguro de eliminar la mesa ${table.number}?`)) return;
    try {
      await deleteTable(table.id);
      loadTables();
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <HeaderPage title="Administración de Mesas" btnTitle="Crear nueva mesa" btnClick={addTable} />

      {loading ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <TableTablesAdmin tables={tables} updateTable={updateTable} onDeleteTable={onDeleteTable} />
      )}

      <ModalBasic show={show} onClose={closeModal} title={title}>
        {content}
      </ModalBasic>
    </>
  );
}
