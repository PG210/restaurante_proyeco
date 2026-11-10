import React from "react";
import { Button, Form, Message } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { billApi } from "../../../../api/bill";
import { formatMoney } from "../../../../utils/money";
import { notifyError } from "../../../../utils/notify";

const REASON_MAX_LENGTH = 255;

export function ReversePaymentForm({ payment, onClose, onReversed }) {
  const formik = useFormik({
    initialValues: { reason: "" },
    validationSchema: Yup.object({
      reason: Yup.string().trim().max(REASON_MAX_LENGTH).required("Indica el motivo de la anulación"),
    }),
    validateOnChange: false,
    onSubmit: async ({ reason }) => {
      try {
        await billApi.reversePayment(payment.id, reason.trim());
        onReversed();
        onClose();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <Form onSubmit={formik.handleSubmit}>
      <Message
        warning
        size="small"
        content={`Se registrará un pago negativo de ${formatMoney(payment.amount)} (${payment.method_label}). El pago original no se borra.`}
      />
      <Form.TextArea
        name="reason"
        placeholder="Motivo de la anulación"
        value={formik.values.reason}
        onChange={formik.handleChange}
        error={formik.errors.reason}
      />
      <Button type="submit" negative fluid loading={formik.isSubmitting} content="Anular pago" />
    </Form>
  );
}
