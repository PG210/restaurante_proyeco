import React, { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button, Checkbox, Form, Image } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import "./AddEditProductForm.scss";
import { useCategory, useProduct } from "../../../../hooks";
import { notifyError } from "../../../../utils/notify";
import { productApi } from "../../../../api/product";
import { ProductLabelsField, labelsPayload, productLabelInitialValues, withoutLabels } from "./ProductLabelsField";
import { StockFields, stockInitialValues, stockSchema, toProductPayload } from "./StockFields";

const ACCEPTED_IMAGES = {
  "image/jpeg": [],
  "image/png": [],
};
const PRICE_DECIMAL_PLACES = 2;
const PRICE_DECIMALS_MESSAGE = `El precio admite hasta ${PRICE_DECIMAL_PLACES} decimales`;
const DESCRIPTION_MAX_LENGTH = 500;
const POSITION_MESSAGE = "El orden es un número entero desde 0";

export function AddEditProductForm({ onClose, onRefetch, product }) {
  const { categories, getCategories } = useCategory();
  const { addProduct, updateProduct } = useProduct();
  const [previewImage, setPreviewImage] = useState(product?.image || null);

  useEffect(() => {
    getCategories().catch(notifyError);
  }, [getCategories]);

  const formik = useFormik({
    initialValues: initialValues(product),
    validationSchema: Yup.object(productSchema(Boolean(product))),
    validateOnChange: false,
    onSubmit: async (formValue) => {
      try {
        const payload = toProductPayload(withoutLabels(formValue), product);
        const saved = product ? await updateProduct(product.id, payload) : await addProduct(payload);
        const labels = labelsPayload(formValue, product);
        if (labels) await productApi.setLabels(saved?.id ?? product.id, labels);
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
    <Form className="add-edit-product-form" onSubmit={formik.handleSubmit}>
      <Form.Input
        name="title"
        placeholder="Nombre del producto"
        value={formik.values.title}
        onChange={formik.handleChange}
        error={formik.errors.title}
      />

      <Form.TextArea
        id="product-description"
        name="description"
        label="Descripción"
        placeholder="Ingredientes y presentación"
        maxLength={DESCRIPTION_MAX_LENGTH}
        value={formik.values.description}
        onChange={formik.handleChange}
        error={formik.errors.description}
      />

      <Form.Input
        type="number"
        step="0.01"
        name="price"
        placeholder="Precio del producto"
        value={formik.values.price}
        onChange={formik.handleChange}
        error={formik.errors.price}
      />

      <Form.Dropdown
        name="category"
        placeholder="Categoría"
        fluid
        search
        selection
        options={toDropdownOptions(categories)}
        value={formik.values.category}
        error={formik.errors.category}
        onChange={(_, data) => formik.setFieldValue("category", data.value)}
      />

      <Form.Input
        id="product-position"
        type="number"
        min="0"
        step="1"
        name="position"
        label="Orden en la carta"
        value={formik.values.position}
        onChange={formik.handleChange}
        error={formik.errors.position}
      />

      <div className="add-edit-product-form__active">
        <Checkbox
          toggle
          checked={formik.values.active}
          onChange={(_, data) => formik.setFieldValue("active", data.checked)}
        />
        <span>Mostrar en la carta</span>
      </div>

      <StockFields formik={formik} isUpdate={Boolean(product)} />

      <ProductLabelsField formik={formik} />

      <Button type="button" fluid {...getRootProps()} color={formik.errors.image && "red"}>
        {previewImage ? "Cambiar imagen" : "Subir imagen del producto"}
      </Button>
      <input {...getInputProps()} />
      <Image src={previewImage} />

      <Button
        type="submit"
        primary
        fluid
        loading={formik.isSubmitting}
        content={product ? "Actualizar" : "Crear"}
      />
    </Form>
  );
}

function toDropdownOptions(categories) {
  return (categories || []).map((category) => ({
    key: category.id,
    text: category.title,
    value: category.id,
  }));
}

function initialValues(product) {
  return {
    title: product?.title || "",
    description: product?.description || "",
    price: product?.price || "",
    position: product?.position ?? 0,
    category: product?.category_data?.id ?? "",
    active: Boolean(product?.active),
    image: null,
    ...stockInitialValues(product),
    ...productLabelInitialValues(product),
  };
}

function hasAllowedDecimals(value) {
  if (value === undefined || value === null) return true;
  const [, decimals = ""] = String(value).split(".");
  return decimals.length <= PRICE_DECIMAL_PLACES;
}

function productSchema(isUpdate) {
  return {
    title: Yup.string().required(true),
    description: Yup.string().max(DESCRIPTION_MAX_LENGTH),
    position: Yup.number().typeError(POSITION_MESSAGE).integer(POSITION_MESSAGE).min(0, POSITION_MESSAGE).required(POSITION_MESSAGE),
    price: Yup.number().required(true).positive(true).test("decimals", PRICE_DECIMALS_MESSAGE, hasAllowedDecimals),
    category: Yup.number().required(true),
    active: Yup.boolean().required(true),
    image: isUpdate ? Yup.mixed().nullable() : Yup.mixed().required("La imagen es obligatoria"),
    ...stockSchema,
  };
}
