import React, { useState } from "react";
import { Button, Checkbox, Form, Image } from "semantic-ui-react";
import { useDropzone } from "react-dropzone";
import { useFormik } from "formik";
import * as Yup from "yup";
import "./AddEditCategoryForm.scss";
import { useCategory } from "../../../../hooks";
import { notifyError } from "../../../../utils/notify";

const ACCEPTED_IMAGES = {
  "image/jpeg": [".jpeg", ".jpg"],
  "image/png": [".png"],
};
const POSITION_MESSAGE = "El orden es un número entero desde 0";

export function AddEditCategoryForm({ onClose, onRefetch, category }) {
  const [previewImage, setPreviewImage] = useState(category?.image || null);
  const { addCategory, updateCategory } = useCategory();

  const formik = useFormik({
    initialValues: initialValues(category),
    validationSchema: Yup.object(categorySchema(Boolean(category))),
    validateOnChange: false,
    onSubmit: async (formValue) => {
      try {
        if (category) await updateCategory(category.id, formValue);
        else await addCategory(formValue);
        onRefetch();
        onClose();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  const onDrop = (acceptedFiles) => {
    const [file] = acceptedFiles;
    if (!file) return;
    formik.setFieldValue("image", file);
    setPreviewImage(URL.createObjectURL(file));
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: ACCEPTED_IMAGES,
    noKeyboard: true,
    multiple: false,
    onDrop,
  });

  return (
    <Form className="add-edit-category-form" onSubmit={formik.handleSubmit}>
      <Form.Input
        placeholder="Nombre de la categoría"
        name="title"
        value={formik.values.title}
        onChange={formik.handleChange}
        error={formik.errors.title}
      />

      <Form.Input
        id="category-position"
        type="number"
        min="0"
        step="1"
        name="position"
        label="Orden en la carta"
        value={formik.values.position}
        onChange={formik.handleChange}
        error={formik.errors.position}
      />

      <Checkbox
        toggle
        id="category-active"
        label="Visible en la carta"
        checked={formik.values.active}
        onChange={(_, data) => formik.setFieldValue("active", data.checked)}
      />

      <Button type="button" fluid {...getRootProps()} color={formik.errors.image ? "red" : "blue"}>
        {previewImage ? "Cambiar imagen" : "Subir imagen"}
      </Button>

      <input {...getInputProps()} />

      {previewImage && <Image src={previewImage} alt="preview" className="image" fluid />}

      <Button
        type="submit"
        primary
        fluid
        loading={formik.isSubmitting}
        content={category ? "Actualizar" : "Crear"}
      />
    </Form>
  );
}

function initialValues(category) {
  return {
    title: category?.title || "",
    active: category?.active ?? true,
    position: category?.position ?? 0,
    image: null,
  };
}

function categorySchema(isUpdate) {
  return {
    title: Yup.string().required(true),
    active: Yup.boolean().required(true),
    position: Yup.number().typeError(POSITION_MESSAGE).integer(POSITION_MESSAGE).min(0, POSITION_MESSAGE).required(POSITION_MESSAGE),
    image: isUpdate ? Yup.mixed().nullable() : Yup.mixed().required(true),
  };
}
