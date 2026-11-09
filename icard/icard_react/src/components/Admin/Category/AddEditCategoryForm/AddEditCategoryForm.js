import React, { useState } from "react";
import { Button, Form, Image } from "semantic-ui-react";
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
    image: "",
  };
}

function categorySchema(isUpdate) {
  return {
    title: Yup.string().required(true),
    image: isUpdate ? Yup.mixed() : Yup.mixed().required(true),
  };
}
