import React, { useState } from "react";
import { Button, Label, Message, Table } from "semantic-ui-react";
import { cashClosingApi } from "../../../api/reports";
import { formatDateTime } from "../../../utils/dateRange";
import { ModalBasic } from "../../Common";
import { DifferenceCell } from "./CashClosingResult";
import { TextForm } from "./TextForm";

export function CashClosingHistory({ closings, canVoid, onVoided }) {
  const [voiding, setVoiding] = useState(null);

  if (!closings.length) return <Message info size="small" content="Todavía no hay cierres de caja." />;

  const voidClosing = async (reason) => {
    await cashClosingApi.void(voiding.id, reason);
    setVoiding(null);
    onVoided();
  };

  return (
    <>
      <Table compact unstackable aria-label="Cierres anteriores">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Jornada</Table.HeaderCell>
            <Table.HeaderCell>Cerrada</Table.HeaderCell>
            <Table.HeaderCell>Por</Table.HeaderCell>
            <Table.HeaderCell>Diferencia</Table.HeaderCell>
            <Table.HeaderCell>Nota</Table.HeaderCell>
            {canVoid && <Table.HeaderCell />}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {closings.map((closing) => (
            <Table.Row key={closing.id} disabled={Boolean(closing.voided_at)}>
              <Table.Cell>{closing.service_day}</Table.Cell>
              <Table.Cell>{formatDateTime(closing.closed_at)}</Table.Cell>
              <Table.Cell>{closing.closed_by_name}</Table.Cell>
              <DifferenceCell value={closing.total_difference} />
              <Table.Cell>
                {closing.voided_at ? (
                  <Label size="small" color="grey" content={`Anulado: ${closing.void_reason}`} />
                ) : (
                  closing.note
                )}
              </Table.Cell>
              {canVoid && (
                <Table.Cell>
                  {!closing.voided_at && (
                    <Button
                      size="mini"
                      basic
                      negative
                      aria-label={`Anular cierre del ${closing.service_day}`}
                      content="Anular"
                      onClick={() => setVoiding(closing)}
                    />
                  )}
                </Table.Cell>
              )}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <ModalBasic show={voiding !== null} onClose={() => setVoiding(null)} title="Anular cierre de caja">
        <p>El cierre anulado se conserva y la jornada se puede volver a cerrar.</p>
        <TextForm
          label="Motivo"
          requiredMessage="Indica el motivo de la anulación"
          submitLabel="Anular cierre"
          negative
          onSubmit={voidClosing}
        />
      </ModalBasic>
    </>
  );
}
