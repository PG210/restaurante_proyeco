import React, { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Header, Icon, Loader, Message, Segment } from "semantic-ui-react";
import { AddEditLabelForm, HeaderPage, TableLabelAdmin } from "../../components/Admin";
import { ModalBasic } from "../../components/Common";
import { useAllergens, useFormModal, useTags } from "../../hooks";
import { ADMIN_SECTIONS } from "../../utils/adminSections";
import { notifyError } from "../../utils/notify";

const KINDS = {
  allergens: {
    title: "Alérgenos",
    noun: "el alérgeno",
    newLabel: "Nuevo alérgeno",
    editTitle: "Actualizar alérgeno",
    hint: "Lo que el producto contiene. En la carta se muestra como advertencia y el cliente puede ocultar los productos que lo lleven.",
  },
  tags: {
    title: "Etiquetas",
    noun: "la etiqueta",
    newLabel: "Nueva etiqueta",
    editTitle: "Actualizar etiqueta",
    hint: "Lo que destaca el producto (vegano, picante…). El cliente puede ver solo los productos que la tengan.",
  },
};

export function deleteLabelConfirmation(kind, label) {
  const usage = label.product_count ? ` Lo usan ${label.product_count} producto(s); se les quitará.` : "";
  return `¿Eliminar ${KINDS[kind].noun} ${label.name}?${usage} Si solo quieres ocultarlo, desactívalo.`;
}

export function LabelsAdmin() {
  const navigate = useNavigate();
  const { show, title, content, openModal, closeModal } = useFormModal();
  const resources = { allergens: useAllergens(), tags: useTags() };

  return (
    <>
      <HeaderPage
        title="Alérgenos y etiquetas"
        btnTitleTwo="Volver a productos"
        btnClickTwo={() => navigate(ADMIN_SECTIONS.products.path)}
      />
      <Message info size="small">
        Se asignan a cada producto desde su formulario. Desactivar uno lo oculta de la carta sin quitarlo de los
        productos.
      </Message>
      {Object.keys(KINDS).map((kind) => (
        <LabelSection
          key={kind}
          kind={kind}
          resource={resources[kind]}
          openModal={openModal}
          closeModal={closeModal}
        />
      ))}
      <ModalBasic show={show} onClose={closeModal} title={title} size="small">
        {content}
      </ModalBasic>
    </>
  );
}

function LabelSection({ kind, resource, openModal, closeModal }) {
  const config = KINDS[kind];
  const { items, getItems, addItem, updateItem, deleteItem } = resource;

  const load = useCallback(() => getItems().catch(notifyError), [getItems]);

  useEffect(() => {
    load();
  }, [load]);

  const openForm = (label) =>
    openModal(
      label ? config.editTitle : config.newLabel,
      <AddEditLabelForm
        label={label}
        onSave={(payload) => (label ? updateItem(label.id, payload) : addItem(payload))}
        onClose={closeModal}
        onRefetch={load}
      />,
    );

  const onDelete = async (label) => {
    if (!window.confirm(deleteLabelConfirmation(kind, label))) return;
    try {
      await deleteItem(label.id);
      load();
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <Segment basic>
      <Header as="h3">
        {config.title}
        <Header.Subheader>{config.hint}</Header.Subheader>
      </Header>
      <Button positive size="small" onClick={() => openForm(undefined)}>
        <Icon name="plus" /> {config.newLabel}
      </Button>
      {items === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <TableLabelAdmin labels={items} caption={config.title} onEdit={openForm} onDelete={onDelete} />
      )}
    </Segment>
  );
}
