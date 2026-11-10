import React, { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader } from "semantic-ui-react";
import { AddEditTableForm, HeaderPage, TableQr, TableTablesAdmin } from "../../components/Admin";
import { ModalBasic, TableFilters } from "../../components/Common";
import { useFormModal, useTable, useTableFilters } from "../../hooks";
import { OPEN_OPTIONS, TABLE_FILTERS } from "../../utils/catalogFilters";
import { ADMIN_SECTIONS } from "../../utils/adminSections";
import { notifyError } from "../../utils/notify";

const TABLE_SELECTS = [{ name: "open", label: "Estado", options: OPEN_OPTIONS }];

export function TablesAdmin() {
  const navigate = useNavigate();
  const { show, title, content, openModal, closeModal } = useFormModal();
  const { tables, getTables, deleteTable } = useTable();
  const tableFilters = useTableFilters(tables, TABLE_FILTERS);

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

  const showQr = (table) => {
    openModal(`QR de la mesa ${table.number}`, <TableQr table={table} onRegenerated={loadTables} />);
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
      <HeaderPage
        title="Administración de Mesas"
        btnTitle="Crear nueva mesa"
        btnClick={addTable}
        btnTitleTwo="Imprimir QR"
        btnClickTwo={() => navigate(ADMIN_SECTIONS.tablesQr.path)}
      />

      {tables === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <>
          <TableFilters state={tableFilters} selects={TABLE_SELECTS} searchPlaceholder="Buscar mesa por número" />
          <TableTablesAdmin
            tables={tableFilters.filtered}
          updateTable={updateTable}
          onDeleteTable={onDeleteTable}
            onShowQr={showQr}
          />
        </>
      )}

      <ModalBasic show={show} onClose={closeModal} title={title}>
        {content}
      </ModalBasic>
    </>
  );
}
