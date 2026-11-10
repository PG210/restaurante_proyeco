import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Button, Checkbox, Form, Header, Loader, Message, Segment, Table } from "semantic-ui-react";
import "./SettingsAdmin.scss";
import { configurationApi } from "../../api/configuration";
import { HeaderPage } from "../../components/Admin";
import { formatDateTime } from "../../utils/dateRange";
import { formatCents, isValidMoney, toCents } from "../../utils/money";
import { notifyError } from "../../utils/notify";
import { EMPTY_VALUE } from "../../utils/constants";
import { PAYMENT_MODE, PAYMENT_MODE_LABELS, TAX_TYPE, splitIncludedTaxCents } from "../../utils/tax";

export const EXAMPLE_PRICE = "30000";
const RATE_MAX = 100;
export const TAXES = [
  {
    type: TAX_TYPE.INC,
    flag: "charge_inc",
    rate: "inc_rate",
    referenceRate: "8",
    hint: "Servicio de restaurante (INC, art. 512-9 ET)",
  },
  {
    type: TAX_TYPE.IVA,
    flag: "charge_iva",
    rate: "iva_rate",
    referenceRate: "19",
    hint: "Restaurantes bajo franquicia (IVA, arts. 426 y 468 ET)",
  },
];

export function taxHint(tax) {
  return `${tax.hint}. Tarifa general: ${tax.referenceRate} %`;
}

export function toggleTaxDraft(draft, tax, checked) {
  const other = TAXES.find(({ type }) => type !== tax.type);
  const next = { ...draft, [tax.flag]: checked };
  if (!checked) return next;
  return {
    ...next,
    [other.flag]: false,
    [tax.rate]: draft[tax.rate] === "" ? tax.referenceRate : draft[tax.rate],
  };
}

export function settingsDraft(settings) {
  return {
    charge_inc: settings.charge_inc,
    inc_rate: settings.inc_rate ?? "",
    charge_iva: settings.charge_iva,
    iva_rate: settings.iva_rate ?? "",
    payment_mode: settings.payment_mode,
  };
}

export function validateDraft(draft) {
  const errors = {};
  TAXES.forEach(({ flag, rate }) => {
    if (!draft[flag]) return;
    const valid = isValidMoney(draft[rate]) && toCents(draft[rate]) > 0 && Number(draft[rate]) <= RATE_MAX;
    if (!valid) errors[rate] = "Escribe una tarifa mayor que 0 y hasta 100, con hasta 2 decimales.";
  });
  return errors;
}

export function toSettingsPayload(draft) {
  return {
    ...draft,
    inc_rate: draft.inc_rate === "" ? null : draft.inc_rate,
    iva_rate: draft.iva_rate === "" ? null : draft.iva_rate,
  };
}

export function activeTaxExample(draft) {
  const active = TAXES.find(({ flag }) => draft[flag]);
  if (!active || !isValidMoney(draft[active.rate])) return null;
  const { baseCents, taxCents } = splitIncludedTaxCents(toCents(EXAMPLE_PRICE), draft[active.rate]);
  return `Un plato de ${formatCents(toCents(EXAMPLE_PRICE))} → base ${formatCents(baseCents)}, ${active.type} ${formatCents(taxCents)}, total ${formatCents(toCents(EXAMPLE_PRICE))}`;
}

export function SettingsAdmin() {
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState([]);

  const load = useCallback(async () => {
    try {
      const [settings, history] = await Promise.all([configurationApi.get(), configurationApi.changes(1)]);
      setDraft(settingsDraft(settings));
      setChanges(history.results);
    } catch (error) {
      notifyError(error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!draft) {
    return (
      <Loader active inline="centered">
        Cargando...
      </Loader>
    );
  }

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const toggleTax = (tax, checked) => setDraft((current) => toggleTaxDraft(current, tax, checked));

  const save = async () => {
    const draftErrors = validateDraft(draft);
    setErrors(draftErrors);
    if (Object.keys(draftErrors).length) return;
    setSaving(true);
    try {
      setDraft(settingsDraft(await configurationApi.update(toSettingsPayload(draft))));
      toast.success("Configuración guardada.");
      setChanges((await configurationApi.changes(1)).results);
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  const example = activeTaxExample(draft);

  return (
    <>
      <HeaderPage title="Configuración del restaurante" />

      <Message warning size="small">
        <Message.Header>Antes de activar un impuesto, confírmalo con tu contador</Message.Header>
        <p>
          El servicio de restaurante suele gravarse con INC y las franquicias con IVA. Las personas naturales con
          ingresos de la actividad inferiores a 3.500 UVT y un solo establecimiento no cobran INC (art. 512-13 ET). El
          precio de la carta debe incluir el impuesto, y el ticket no es factura electrónica.
        </p>
      </Message>

      <Segment>
        <Header as="h3">Impuestos</Header>
        <Form>
          {TAXES.map((tax) => (
            <Form.Group key={tax.type} inline className="settings-admin__tax">
              <Checkbox
                toggle
                id={`settings-${tax.flag}`}
                label={`Cobrar ${tax.type}`}
                checked={draft[tax.flag]}
                onChange={(_, data) => toggleTax(tax, data.checked)}
              />
              <Form.Input
                id={`settings-${tax.rate}`}
                label={`Tarifa ${tax.type} (%)`}
                inputMode="decimal"
                value={draft[tax.rate]}
                disabled={!draft[tax.flag]}
                error={errors[tax.rate]}
                onChange={(_, data) => update(tax.rate, data.value)}
              />
              <span className="settings-admin__hint">{taxHint(tax)}</span>
            </Form.Group>
          ))}
        </Form>
        {example && <Message info size="small" content={example} />}
        {!draft.charge_inc && !draft.charge_iva && (
          <Message size="small" content="No se cobra impuesto. El ticket no mostrará desglose." />
        )}
      </Segment>

      <Segment>
        <Header as="h3">Momento de cobro</Header>
        <Form>
          {Object.values(PAYMENT_MODE).map((mode) => (
            <Form.Radio
              key={mode}
              id={`settings-payment-mode-${mode}`}
              label={PAYMENT_MODE_LABELS[mode]}
              value={mode}
              checked={draft.payment_mode === mode}
              onChange={() => update("payment_mode", mode)}
            />
          ))}
        </Form>
        <p className="settings-admin__hint">
          En cobro anticipado, los pedidos llegan a cocina solo después de cobrarlos. Solo se puede cambiar cuando no hay
          cuentas abiertas.
        </p>
      </Segment>

      <Button primary loading={saving} disabled={saving} onClick={save}>
        Guardar configuración
      </Button>

      <Header as="h3">Historial de cambios</Header>
      <SettingsHistory changes={changes} />
    </>
  );
}

function SettingsHistory({ changes }) {
  if (!changes.length) return <Message info size="small" content="Todavía no hay cambios registrados." />;

  return (
    <Table compact unstackable>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Fecha</Table.HeaderCell>
          <Table.HeaderCell>Campo</Table.HeaderCell>
          <Table.HeaderCell>Antes</Table.HeaderCell>
          <Table.HeaderCell>Después</Table.HeaderCell>
          <Table.HeaderCell>Por</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {changes.map((change) => (
          <Table.Row key={change.id}>
            <Table.Cell>{formatDateTime(change.changed_at)}</Table.Cell>
            <Table.Cell>{change.field}</Table.Cell>
            <Table.Cell>{change.old_value || EMPTY_VALUE}</Table.Cell>
            <Table.Cell>{change.new_value || EMPTY_VALUE}</Table.Cell>
            <Table.Cell>{change.changed_by_name}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

