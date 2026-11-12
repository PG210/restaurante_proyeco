import React, { useState } from "react";
import { Button, Form, Message } from "semantic-ui-react";
import { cashClosingApi } from "../../../api/reports";
import { notifyError } from "../../../utils/notify";
import { PAYMENT_METHOD_LABELS } from "../../../utils/paymentMethods";
import { COUNT_METHODS, emptyCount, toCountPayload, validateCount } from "../../../utils/reports";

export const BLIND_COUNT_HINT =
  "Cuenta el dinero y escribe lo que hay. El sistema te mostrará lo esperado y la diferencia después de guardar.";

/** Blind count: it never receives the expected amounts. */
export function CashCountForm({ onClosed }) {
  const [draft, setDraft] = useState(emptyCount);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const setCounted = (method, value) =>
    setDraft((current) => ({ ...current, counted: { ...current.counted, [method]: value } }));

  const submit = async () => {
    const draftErrors = validateCount(draft);
    setErrors(draftErrors);
    if (Object.keys(draftErrors).length) return;
    setSaving(true);
    try {
      onClosed(await cashClosingApi.close(toCountPayload(draft)));
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form onSubmit={submit}>
      <Message info size="small" content={BLIND_COUNT_HINT} />
      <Form.Input
        id="cash-count-float"
        label="Base inicial en efectivo"
        inputMode="decimal"
        placeholder="0"
        value={draft.opening_float}
        error={errors.opening_float}
        onChange={(_, data) => setDraft((current) => ({ ...current, opening_float: data.value }))}
      />
      <Form.Group widths="equal">
        {COUNT_METHODS.map((method) => (
          <Form.Input
            key={method}
            id={`cash-count-${method}`}
            label={`Contado: ${PAYMENT_METHOD_LABELS[method]}`}
            inputMode="decimal"
            placeholder="0"
            value={draft.counted[method]}
            error={errors[method]}
            onChange={(_, data) => setCounted(method, data.value)}
          />
        ))}
      </Form.Group>
      <Form.TextArea
        id="cash-count-note"
        label="Nota (opcional)"
        value={draft.note}
        onChange={(_, data) => setDraft((current) => ({ ...current, note: data.value }))}
      />
      <Button type="submit" primary loading={saving} disabled={saving} content="Cerrar caja" />
    </Form>
  );
}
