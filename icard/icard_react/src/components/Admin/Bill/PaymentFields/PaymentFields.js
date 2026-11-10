import React from "react";
import { Form, Message } from "semantic-ui-react";
import * as Yup from "yup";
import { changeDueCents, formatCents, isValidMoney } from "../../../../utils/money";
import { PAYMENT_METHOD, PAYMENT_METHOD_OPTIONS, needsReference } from "../../../../utils/paymentMethods";

const REFERENCE_MAX_LENGTH = 64;
export const MONEY_FORMAT_MESSAGE = "Usa un número con hasta 2 decimales";

export function paymentFieldsSchema() {
  return {
    method: Yup.string().oneOf(Object.values(PAYMENT_METHOD)).required("Elige un método"),
    tip: Yup.string().test("money", MONEY_FORMAT_MESSAGE, (value) => !value || isValidMoney(value)),
    reference: Yup.string().max(REFERENCE_MAX_LENGTH),
    received: Yup.string().test("money", MONEY_FORMAT_MESSAGE, (value) => !value || isValidMoney(value)),
  };
}

export function paymentFieldsInitialValues() {
  return { method: PAYMENT_METHOD.CASH, tip: "", reference: "", received: "" };
}

export function toPaymentPayload({ method, tip, reference }, amount, orderIds) {
  return {
    method,
    amount,
    tip: tip || "0",
    reference: needsReference(method) ? reference.trim() : "",
    ...(orderIds ? { orders: orderIds } : {}),
  };
}

export function PaymentFields({ formik, amount }) {
  const { method, received } = formik.values;
  const showChange = method === PAYMENT_METHOD.CASH && isValidMoney(received) && isValidMoney(amount);

  return (
    <>
      <Form.Dropdown
        label="Método"
        selection
        options={PAYMENT_METHOD_OPTIONS}
        value={method}
        onChange={(_, data) => formik.setFieldValue("method", data.value)}
        error={formik.errors.method}
      />
      <Form.Input
        id="charge-tip"
        label="Propina (opcional)"
        name="tip"
        inputMode="decimal"
        placeholder="0.00"
        value={formik.values.tip}
        onChange={formik.handleChange}
        error={formik.errors.tip}
      />
      {needsReference(method) && (
        <Form.Input
          id="charge-reference"
          label="Referencia (voucher o transferencia)"
          name="reference"
          value={formik.values.reference}
          onChange={formik.handleChange}
          error={formik.errors.reference}
        />
      )}
      {method === PAYMENT_METHOD.CASH && (
        <Form.Input
          id="charge-received"
          label="Recibido en efectivo (opcional)"
          name="received"
          inputMode="decimal"
          value={received}
          onChange={formik.handleChange}
          error={formik.errors.received}
        />
      )}
      {showChange && (
        <Message positive size="small" content={`Vuelto: ${formatCents(changeDueCents(received, amount))}`} />
      )}
    </>
  );
}
