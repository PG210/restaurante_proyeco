import React from "react";
import { Button, Form } from "semantic-ui-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { notifyError } from "../../../utils/notify";

const TEXT_MAX_LENGTH = 255;

/** One required text (a note or a reason) sent with `onSubmit(text)`. */
export function TextForm({ label, requiredMessage, submitLabel, negative = false, onSubmit }) {
  const formik = useFormik({
    initialValues: { text: "" },
    validationSchema: Yup.object({ text: Yup.string().trim().max(TEXT_MAX_LENGTH).required(requiredMessage) }),
    validateOnChange: false,
    onSubmit: async ({ text }) => {
      try {
        await onSubmit(text.trim());
      } catch (error) {
        notifyError(error);
      }
    },
  });

  return (
    <Form onSubmit={formik.handleSubmit}>
      <Form.TextArea
        id={`text-form-${submitLabel}`}
        name="text"
        label={label}
        maxLength={TEXT_MAX_LENGTH}
        value={formik.values.text}
        onChange={formik.handleChange}
        error={formik.errors.text}
      />
      <Button type="submit" primary={!negative} negative={negative} loading={formik.isSubmitting} content={submitLabel} />
    </Form>
  );
}
