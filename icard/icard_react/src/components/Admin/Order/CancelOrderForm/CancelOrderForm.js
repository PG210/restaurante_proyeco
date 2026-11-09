import React from "react";
import { Button, Form } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useOrder } from "../../../../hooks";
import { notifyError } from "../../../../utils/notify";

const REASON_MAX_LENGTH = 255;

export function CancelOrderForm({ order, onClose, onRefetch }) {
  const { cancelOrder } = useOrder();

  const formik = useFormik({
    initialValues: { reason: "" },
    validationSchema: Yup.object({
      reason: Yup.string().trim().max(REASON_MAX_LENGTH).required("Indica el motivo de la cancelación"),
    }),
    validateOnChange: false,
    onSubmit: async ({ reason }) => {
      try {
        await cancelOrder(order.id, reason.trim());
        onRefetch();
        onClose();
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <Form onSubmit={formik.handleSubmit}>
      <Form.TextArea
        name="reason"
        placeholder="Motivo de la cancelación"
        value={formik.values.reason}
        onChange={formik.handleChange}
        error={formik.errors.reason}
      />
      <Button type="submit" negative fluid loading={formik.isSubmitting} content="Cancelar pedido" />
    </Form>
  );
}
