import React from "react";
import { Button, Form } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import "./AddEditTableForm.scss";
import { useTable } from "../../../../hooks";
import { notifyError } from "../../../../utils/notify";

export function AddEditTableForm({ onClose, onRefetch, table }) {
  const { addTable, updateTable } = useTable();

  const formik = useFormik({
    initialValues: initialValues(table),
    validationSchema: Yup.object(validationSchema()),
    validateOnChange: false,
    onSubmit: async (formValue) => {
      try {
        if (table) await updateTable(table.id, formValue);
        else await addTable(formValue);
        onRefetch();
        onClose();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <Form className="add-edit-table-form" onSubmit={formik.handleSubmit}>
      <Form.Input
        type="number"
        name="number"
        placeholder="Número de la mesa"
        value={formik.values.number}
        onChange={formik.handleChange}
        error={formik.errors.number}
      />

      <Button type="submit" primary fluid loading={formik.isSubmitting} content={table ? "Actualizar" : "Crear"} />
    </Form>
  );
}

function initialValues(table) {
  return {
    number: table?.number || "",
  };
}

function validationSchema() {
  return {
    number: Yup.number().required(true),
  };
}
