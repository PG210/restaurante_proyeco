import React from "react";
import { Button, Checkbox, Form } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { notifyError } from "../../../utils/notify";

const LABEL_NAME_MAX_LENGTH = 50;
const POSITION_MESSAGE = "El orden es un número entero desde 0";

export function toLabelPayload(values) {
  return { name: values.name.trim(), active: values.active, position: Number(values.position) };
}

export function AddEditLabelForm({ label, onSave, onClose, onRefetch }) {
  const formik = useFormik({
    initialValues: {
      name: label?.name ?? "",
      active: label?.active ?? true,
      position: label?.position ?? 0,
    },
    validationSchema: Yup.object({
      name: Yup.string().trim().required("Escribe el nombre").max(LABEL_NAME_MAX_LENGTH),
      position: Yup.number()
        .typeError(POSITION_MESSAGE)
        .integer(POSITION_MESSAGE)
        .min(0, POSITION_MESSAGE)
        .required(POSITION_MESSAGE),
    }),
    validateOnChange: false,
    onSubmit: async (values) => {
      try {
        await onSave(toLabelPayload(values));
        onRefetch();
        onClose();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <Form onSubmit={formik.handleSubmit}>
      <Form.Input
        id="label-name"
        label="Nombre"
        name="name"
        maxLength={LABEL_NAME_MAX_LENGTH}
        value={formik.values.name}
        onChange={formik.handleChange}
        error={formik.errors.name}
      />
      <Form.Input
        id="label-position"
        type="number"
        min="0"
        step="1"
        label="Orden"
        name="position"
        value={formik.values.position}
        onChange={formik.handleChange}
        error={formik.errors.position}
      />
      <Form.Field>
        <Checkbox
          toggle
          id="label-active"
          label="Activo (se muestra en la carta y en el formulario de producto)"
          checked={formik.values.active}
          onChange={(_, data) => formik.setFieldValue("active", data.checked)}
        />
      </Form.Field>
      <Button type="submit" primary fluid loading={formik.isSubmitting} content={label ? "Actualizar" : "Crear"} />
    </Form>
  );
}
