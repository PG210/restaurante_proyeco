import React, { useState } from "react";
import { Button, Checkbox, Form, List, Message } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { billApi } from "../../../../api/bill";
import { linesTotalCents, unpaidLines } from "../../../../utils/bill";
import { formatCents, formatMoney, fromCents } from "../../../../utils/money";
import { notifyError } from "../../../../utils/notify";
import {
  PaymentFields,
  paymentFieldsInitialValues,
  paymentFieldsSchema,
  toPaymentPayload,
} from "../PaymentFields/PaymentFields";
import { titleWithModifiers } from "../../../../utils/modifiers";

export function PrepaidChargeForm({ bill, onClose, onCharged }) {
  const payableLines = unpaidLines(bill);
  const [selectedIds, setSelectedIds] = useState(() => payableLines.map((line) => line.id));
  const selectedLines = payableLines.filter((line) => selectedIds.includes(line.id));
  const amount = fromCents(linesTotalCents(selectedLines));

  const toggle = (lineId) =>
    setSelectedIds((current) => (current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId]));

  const formik = useFormik({
    initialValues: paymentFieldsInitialValues(),
    validationSchema: Yup.object(paymentFieldsSchema()),
    validateOnChange: false,
    onSubmit: async (formValue) => {
      try {
        const updatedBill = await billApi.charge(bill.id, toPaymentPayload(formValue, amount, selectedIds));
        onCharged(updatedBill);
        onClose();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <Form onSubmit={formik.handleSubmit}>
      <Message
        info
        size="small"
        content="Cobro anticipado: los pedidos que cobres pasan a la cocina. Se cobra el total exacto de los pedidos elegidos."
      />
      <List divided>
        {payableLines.map((line) => (
          <List.Item key={line.id}>
            <Checkbox
              id={`prepaid-line-${line.id}`}
              label={`${line.quantity} × ${titleWithModifiers(line.product_title, line.modifiers)} — ${formatMoney(line.line_total)}`}
              checked={selectedIds.includes(line.id)}
              onChange={() => toggle(line.id)}
            />
          </List.Item>
        ))}
      </List>
      <Message size="small" content={`Total a cobrar: ${formatCents(linesTotalCents(selectedLines))}`} />
      <PaymentFields formik={formik} amount={amount} />
      <Button
        type="submit"
        primary
        fluid
        loading={formik.isSubmitting}
        disabled={formik.isSubmitting || !selectedLines.length}
      >
        Cobrar pedidos
      </Button>
    </Form>
  );
}
