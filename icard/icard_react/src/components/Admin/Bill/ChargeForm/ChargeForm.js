import React from "react";
import { Button, Form, Message } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { billApi } from "../../../../api/bill";
import { formatCents, isValidMoney, toCents } from "../../../../utils/money";
import { notifyError } from "../../../../utils/notify";
import {
  MONEY_FORMAT_MESSAGE,
  PaymentFields,
  paymentFieldsInitialValues,
  paymentFieldsSchema,
  toPaymentPayload,
} from "../PaymentFields/PaymentFields";

export function chargeSchema(balance) {
  const balanceCents = toCents(balance);
  return Yup.object({
    ...paymentFieldsSchema(),
    amount: Yup.string()
      .required("Indica el monto")
      .test("money", MONEY_FORMAT_MESSAGE, isValidMoney)
      .test("positive", "El monto debe ser mayor que 0", (value) => toCents(value) > 0)
      .test("balance", `No puede superar el saldo (${formatCents(balanceCents)})`, (value) => toCents(value) <= balanceCents),
  });
}

export function ChargeForm({ bill, onClose, onCharged }) {
  const balance = bill.totals.balance;

  const formik = useFormik({
    initialValues: { ...paymentFieldsInitialValues(), amount: balance },
    validationSchema: chargeSchema(balance),
    validateOnChange: false,
    onSubmit: async (formValue) => {
      try {
        const updatedBill = await billApi.charge(bill.id, toPaymentPayload(formValue, formValue.amount));
        onCharged(updatedBill);
        onClose();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <Form onSubmit={formik.handleSubmit}>
      <Message info size="small" content={`Saldo pendiente: ${formatCents(toCents(balance))}`} />
      <Form.Input
        id="charge-amount"
        label="Monto"
        name="amount"
        inputMode="decimal"
        value={formik.values.amount}
        onChange={formik.handleChange}
        error={formik.errors.amount}
      />
      <PaymentFields formik={formik} amount={formik.values.amount} />
      <Button type="submit" primary fluid loading={formik.isSubmitting} disabled={formik.isSubmitting}>
        Registrar pago
      </Button>
    </Form>
  );
}
