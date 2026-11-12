import React from "react";
import "./CashClosing.scss";
import { Header, Message, Segment, Table } from "semantic-ui-react";
import { cashClosingApi } from "../../../api/reports";
import { formatDateTime } from "../../../utils/dateRange";
import { formatMoney } from "../../../utils/money";
import { NOTE_REQUIRED_MESSAGE, differenceColor, formatSignedMoney } from "../../../utils/reports";
import { TextForm } from "./TextForm";

export function DifferenceCell({ value }) {
  return (
    <Table.Cell className={`cash-closing__difference cash-closing__difference--${differenceColor(value)}`}>
      {formatSignedMoney(value)}
    </Table.Cell>
  );
}

export function CashClosingResult({ closing, onChange }) {
  const addNote = async (text) => onChange(await cashClosingApi.addNote(closing.id, text));

  return (
    <Segment role="region" aria-label="Cierre de la jornada">
      <Header as="h3">
        Caja cerrada
        <Header.Subheader>
          {formatDateTime(closing.closed_at)} · {closing.closed_by_name} · base {formatMoney(closing.opening_float)}
        </Header.Subheader>
      </Header>
      <Table compact unstackable aria-label="Resultado del cierre">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Método</Table.HeaderCell>
            <Table.HeaderCell>Esperado</Table.HeaderCell>
            <Table.HeaderCell>Contado</Table.HeaderCell>
            <Table.HeaderCell>Diferencia</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {closing.lines.map((line) => (
            <Table.Row key={line.method}>
              <Table.Cell>{line.method_label}</Table.Cell>
              <Table.Cell>{formatMoney(line.expected)}</Table.Cell>
              <Table.Cell>{formatMoney(line.counted)}</Table.Cell>
              <DifferenceCell value={line.difference} />
            </Table.Row>
          ))}
        </Table.Body>
        <Table.Footer>
          <Table.Row>
            <Table.HeaderCell colSpan={3}>Diferencia total</Table.HeaderCell>
            <DifferenceCell value={closing.total_difference} />
          </Table.Row>
        </Table.Footer>
      </Table>
      {closing.note && <p>Nota: {closing.note}</p>}
      {closing.needs_note && (
        <>
          <Message warning size="small" content={NOTE_REQUIRED_MESSAGE} />
          <TextForm
            label="Nota"
            requiredMessage="Escribe la explicación"
            submitLabel="Guardar nota"
            onSubmit={addNote}
          />
        </>
      )}
    </Segment>
  );
}
