import React, { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader, Message } from "semantic-ui-react";
import { AddEditModifierGroupForm, HeaderPage, TableModifierGroupAdmin } from "../../components/Admin";
import { ModalBasic, TableFilters } from "../../components/Common";
import { useFormModal, useModifierGroup, useTableFilters } from "../../hooks";
import { ADMIN_SECTIONS } from "../../utils/adminSections";
import { ACTIVE_OPTIONS, MODIFIER_GROUP_FILTERS } from "../../utils/catalogFilters";
import { notifyError } from "../../utils/notify";

const GROUP_SELECTS = [{ name: "active", label: "Estado", options: ACTIVE_OPTIONS }];

export function deleteGroupConfirmation(group) {
  const usage = group.product_count ? ` Lo usan ${group.product_count} producto(s); se les quitará.` : "";
  return `¿Eliminar el grupo ${group.name}?${usage} Los pedidos ya hechos conservan sus opciones.`;
}

export function ModifiersAdmin() {
  const navigate = useNavigate();
  const { show, title, content, openModal, closeModal } = useFormModal();
  const { modifierGroups, getModifierGroups, deleteModifierGroup } = useModifierGroup();
  const groupFilters = useTableFilters(modifierGroups, MODIFIER_GROUP_FILTERS);

  const loadGroups = useCallback(() => getModifierGroups().catch(notifyError), [getModifierGroups]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const openForm = (group) =>
    openModal(
      group ? "Actualizar grupo de opciones" : "Nuevo grupo de opciones",
      <AddEditModifierGroupForm group={group} onClose={closeModal} onRefetch={loadGroups} />,
    );

  const onDelete = async (group) => {
    if (!window.confirm(deleteGroupConfirmation(group))) return;
    try {
      await deleteModifierGroup(group.id);
      loadGroups();
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <>
      <HeaderPage
        title="Modificadores"
        btnTitle="Nuevo grupo"
        btnClick={() => openForm(undefined)}
        btnTitleTwo="Volver a productos"
        btnClickTwo={() => navigate(ADMIN_SECTIONS.products.path)}
      />
      <Message info size="small">
        Crea grupos como "Término de la carne" o "Extras" y asígnalos a los productos desde su formulario. El precio
        de cada opción se suma al del producto.
      </Message>

      {modifierGroups === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <>
          <TableFilters state={groupFilters} selects={GROUP_SELECTS} searchPlaceholder="Buscar grupo u opción" />
          <TableModifierGroupAdmin groups={groupFilters.filtered} onEdit={openForm} onDelete={onDelete} />
        </>
      )}

      <ModalBasic show={show} onClose={closeModal} title={title} size="small">
        {content}
      </ModalBasic>
    </>
  );
}
