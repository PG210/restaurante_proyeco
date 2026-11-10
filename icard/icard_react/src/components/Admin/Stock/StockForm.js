import React from "react";
import { Button, Form } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { productApi } from "../../../api/product";
import { notifyError } from "../../../utils/notify";

export const STOCK_FORM_MODE = { ADD: "add", SET: "set" };

const NOTE_MAX_LENGTH = 255;
const UNITS_MESSAGE = "Escribe un número entero";

const MODES = {
  [STOCK_FORM_MODE.ADD]: {
    unitsLabel: "Unidades que llegaron",
    minUnits: 1,
    submitText: "Sumar unidades",
    submit: (product, values) => productApi.addStock(product.id, Number(values.units)),
  },
  [STOCK_FORM_MODE.SET]: {
    unitsLabel: "Unidades contadas",
    minUnits: 0,
    submitText: "Ajustar stock",
    submit: (product, values) => productApi.setStock(product.id, Number(values.units), values.note.trim()),
  },
};

function stockFormSchema(mode) {
  const { minUnits } = MODES[mode];
  return Yup.object({
    units: Yup.number()
      .typeError(UNITS_MESSAGE)
      .integer(UNITS_MESSAGE)
      .min(minUnits, `Mínimo ${minUnits}`)
      .required(UNITS_MESSAGE),
    note:
      mode === STOCK_FORM_MODE.SET
        ? Yup.string().trim().required("Escribe el motivo del ajuste").max(NOTE_MAX_LENGTH)
        : Yup.string(),
  });
}

export function StockForm({ product, mode, onSaved, onClose }) {
  const config = MODES[mode];
  const formik = useFormik({
    initialValues: { units: "", note: "" },
    validationSchema: stockFormSchema(mode),
    validateOnChange: false,
    onSubmit: async (values) => {
      try {
        onSaved(await config.submit(product, values));
        onClose();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <Form onSubmit={formik.handleSubmit}>
      <p>
        {product.title}: quedan <strong>{product.stock}</strong>.
      </p>
      <Form.Input
        id="stock-units"
        type="number"
        min={config.minUnits}
        step="1"
        name="units"
        label={config.unitsLabel}
        value={formik.values.units}
        onChange={formik.handleChange}
        error={formik.errors.units}
      />
      {mode === STOCK_FORM_MODE.SET && (
        <Form.Input
          id="stock-note"
          name="note"
          label="Motivo"
          placeholder="Conteo de cierre, producto dañado…"
          maxLength={NOTE_MAX_LENGTH}
          value={formik.values.note}
          onChange={formik.handleChange}
          error={formik.errors.note}
        />
      )}
      <Button type="submit" primary fluid loading={formik.isSubmitting} content={config.submitText} />
    </Form>
  );
}
