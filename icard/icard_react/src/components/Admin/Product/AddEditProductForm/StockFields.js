import React from "react";
import { Checkbox, Form } from "semantic-ui-react";
import * as Yup from "yup";

const UNITS_MESSAGE = "Escribe un número entero desde 0";
const STOCK_FIELDS = ["trackStock", "stock", "low_stock_threshold"];
const EMPTY = "";

function wholeNumber() {
  return Yup.number().typeError(UNITS_MESSAGE).integer(UNITS_MESSAGE).min(0, UNITS_MESSAGE);
}

export const stockSchema = {
  trackStock: Yup.boolean(),
  stock: Yup.mixed().when("trackStock", {
    is: true,
    then: () => wholeNumber().required(UNITS_MESSAGE),
    otherwise: () => Yup.mixed().nullable(),
  }),
  low_stock_threshold: wholeNumber().nullable().transform((value, original) => (original === EMPTY ? null : value)),
};

export function stockInitialValues(product) {
  const tracksStock = product?.stock !== null && product?.stock !== undefined;
  return {
    trackStock: tracksStock,
    stock: tracksStock ? product.stock : EMPTY,
    low_stock_threshold: product?.low_stock_threshold ?? EMPTY,
  };
}

function stockPayload(values, product) {
  const tracked = stockInitialValues(product).trackStock;
  if (!values.trackStock) return tracked ? { stock: EMPTY, low_stock_threshold: EMPTY } : {};
  const stockChanged = !tracked || Number(values.stock) !== product.stock;
  return {
    ...(stockChanged ? { stock: values.stock } : {}),
    low_stock_threshold: values.low_stock_threshold,
  };
}

export function toProductPayload(values, product) {
  const baseFields = Object.fromEntries(Object.entries(values).filter(([field]) => !STOCK_FIELDS.includes(field)));
  return { ...baseFields, ...stockPayload(values, product) };
}

export function StockFields({ formik, isUpdate }) {
  return (
    <div className="add-edit-product-form__stock">
      <Checkbox
        toggle
        id="product-track-stock"
        label="Controlar stock (unidades)"
        checked={formik.values.trackStock}
        onChange={(_, data) => formik.setFieldValue("trackStock", data.checked)}
      />
      {formik.values.trackStock && (
        <Form.Group widths="equal">
          <Form.Input
            id="product-stock"
            type="number"
            min="0"
            step="1"
            name="stock"
            label={isUpdate ? "Unidades actuales" : "Unidades iniciales"}
            value={formik.values.stock}
            onChange={formik.handleChange}
            error={formik.errors.stock}
          />
          <Form.Input
            id="product-low-stock"
            type="number"
            min="0"
            step="1"
            name="low_stock_threshold"
            label="Avisar cuando queden"
            placeholder="Sin aviso"
            value={formik.values.low_stock_threshold}
            onChange={formik.handleChange}
            error={formik.errors.low_stock_threshold}
          />
        </Form.Group>
      )}
      {formik.values.trackStock && isUpdate && (
        <p className="add-edit-product-form__hint">Para reponer o ajustar con historial, usa "Disponibilidad y stock".</p>
      )}
    </div>
  );
}
