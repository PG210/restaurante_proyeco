import React from "react";
import { Button, Checkbox, Form, Header, Icon, Message } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import "./AddEditModifierGroupForm.scss";
import { useModifierGroup } from "../../../../hooks";
import { notifyError } from "../../../../utils/notify";

const WHOLE_NUMBER_MESSAGE = "Debe ser un número entero desde 0";
const MAX_CHOICES_MESSAGE = "El máximo es al menos 1 y no menor que el mínimo";
const PRICE_MESSAGE = "El precio extra es 0 o más";
export const NOT_ENOUGH_OPTIONS_MESSAGE = "No hay suficientes opciones activas para el mínimo";

export function AddEditModifierGroupForm({ group, onClose, onRefetch }) {
  const { addModifierGroup, updateModifierGroup } = useModifierGroup();

  const formik = useFormik({
    initialValues: initialValues(group),
    validationSchema: groupSchema(),
    validateOnChange: false,
    onSubmit: async (formValue) => {
      try {
        const payload = toGroupPayload(formValue);
        if (group) await updateModifierGroup(group.id, payload);
        else await addModifierGroup(payload);
        onRefetch();
        onClose();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  const options = formik.values.modifiers;
  const setOptions = (next) => formik.setFieldValue("modifiers", next);
  const changeOption = (index, field, value) =>
    setOptions(options.map((option, position) => (position === index ? { ...option, [field]: value } : option)));

  return (
    <Form className="add-edit-modifier-group-form" onSubmit={formik.handleSubmit}>
      <Form.Input
        id="modifier-group-name"
        label="Nombre del grupo"
        placeholder="Ej. Término de la carne"
        name="name"
        value={formik.values.name}
        onChange={formik.handleChange}
        error={formik.errors.name}
      />
      <Form.Group widths="equal">
        <Form.Input
          id="modifier-group-min"
          type="number"
          min="0"
          label="Mínimo a elegir"
          name="min_choices"
          value={formik.values.min_choices}
          onChange={formik.handleChange}
          error={formik.errors.min_choices}
        />
        <Form.Input
          id="modifier-group-max"
          type="number"
          min="1"
          label="Máximo a elegir"
          name="max_choices"
          value={formik.values.max_choices}
          onChange={formik.handleChange}
          error={formik.errors.max_choices}
        />
        <Form.Input
          id="modifier-group-position"
          type="number"
          min="0"
          label="Orden"
          name="position"
          value={formik.values.position}
          onChange={formik.handleChange}
          error={formik.errors.position}
        />
      </Form.Group>
      <Message size="mini" content="Mínimo 0 = opcional. Mínimo 1 y máximo 1 = elegir una obligatoriamente." />
      <Checkbox
        toggle
        id="modifier-group-active"
        label="Activo"
        checked={formik.values.active}
        onChange={(_, data) => formik.setFieldValue("active", data.checked)}
      />

      <Header as="h4">Opciones</Header>
      {options.map((option, index) => (
        <OptionRow
          key={option.id ?? `new-${index}`}
          option={option}
          index={index}
          errors={formik.errors.modifiers?.[index]}
          onChange={changeOption}
          onRemove={() => setOptions(options.filter((_, position) => position !== index))}
        />
      ))}
      {typeof formik.errors.modifiers === "string" && <Message negative size="mini" content={formik.errors.modifiers} />}
      <Button type="button" basic onClick={() => setOptions([...options, emptyOption()])}>
        <Icon name="plus" /> Añadir opción
      </Button>

      <Button type="submit" primary fluid loading={formik.isSubmitting} content={group ? "Actualizar" : "Crear"} />
    </Form>
  );
}

function OptionRow({ option, index, errors, onChange, onRemove }) {
  const number = index + 1;
  return (
    <Form.Group className="add-edit-modifier-group-form__option" unstackable>
      <Form.Input
        width={7}
        aria-label={`Nombre de la opción ${number}`}
        placeholder="Nombre"
        value={option.name}
        onChange={(_, data) => onChange(index, "name", data.value)}
        error={errors?.name}
      />
      <Form.Input
        width={4}
        type="number"
        min="0"
        step="0.01"
        aria-label={`Precio extra de la opción ${number}`}
        placeholder="Precio extra"
        value={option.price_delta}
        onChange={(_, data) => onChange(index, "price_delta", data.value)}
        error={errors?.price_delta}
      />
      <Form.Field width={3} className="add-edit-modifier-group-form__active">
        <Checkbox
          aria-label={`Opción ${number} activa`}
          label="Activa"
          checked={option.active}
          onChange={(_, data) => onChange(index, "active", data.checked)}
        />
      </Form.Field>
      <Form.Field width={2}>
        <Button type="button" icon basic negative aria-label={`Quitar opción ${number}`} onClick={onRemove}>
          <Icon name="trash" />
        </Button>
      </Form.Field>
    </Form.Group>
  );
}

function emptyOption() {
  return { name: "", price_delta: "0", active: true };
}

function initialValues(group) {
  return {
    name: group?.name ?? "",
    min_choices: group?.min_choices ?? 0,
    max_choices: group?.max_choices ?? 1,
    active: group?.active ?? true,
    position: group?.position ?? 0,
    modifiers: (group?.modifiers ?? []).map(({ id, name, price_delta, active }) => ({ id, name, price_delta, active })),
  };
}

export function toGroupPayload(values) {
  return {
    name: values.name.trim(),
    min_choices: Number(values.min_choices),
    max_choices: Number(values.max_choices),
    active: values.active,
    position: Number(values.position),
    modifiers: values.modifiers.map((option, index) => ({
      ...(option.id ? { id: option.id } : {}),
      name: option.name.trim(),
      price_delta: option.price_delta === "" ? "0" : String(option.price_delta),
      active: option.active,
      position: index,
    })),
  };
}

function wholeNumber() {
  return Yup.number().typeError(WHOLE_NUMBER_MESSAGE).integer(WHOLE_NUMBER_MESSAGE).min(0, WHOLE_NUMBER_MESSAGE);
}

function groupSchema() {
  return Yup.object({
    name: Yup.string().trim().required("Escribe el nombre del grupo"),
    min_choices: wholeNumber().required(WHOLE_NUMBER_MESSAGE),
    max_choices: wholeNumber()
      .min(1, MAX_CHOICES_MESSAGE)
      .required(MAX_CHOICES_MESSAGE)
      .test("not-below-min", MAX_CHOICES_MESSAGE, function notBelowMin(value) {
        return Number(value) >= Number(this.parent.min_choices);
      }),
    position: wholeNumber().required(WHOLE_NUMBER_MESSAGE),
    modifiers: Yup.array()
      .of(
        Yup.object({
          name: Yup.string().trim().required("Escribe el nombre"),
          price_delta: Yup.number().typeError(PRICE_MESSAGE).min(0, PRICE_MESSAGE),
        }),
      )
      .test("enough-active", NOT_ENOUGH_OPTIONS_MESSAGE, function enoughActive(options) {
        return (options ?? []).filter((option) => option.active).length >= Number(this.parent.min_choices);
      }),
  });
}
