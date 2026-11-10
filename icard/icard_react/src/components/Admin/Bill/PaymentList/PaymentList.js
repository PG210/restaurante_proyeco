import React from "react";
import { Button, Label, Table } from "semantic-ui-react";
import { formatDateTime } from "../../../../utils/dateRange";
import { formatMoney } from "../../../../utils/money";

export function canReversePayment(payment, { billIsOpen, isStaff }) {
  return isStaff && billIsOpen && !payment.reverses && !payment.is_reversed;
}

export function PaymentList({ payments, billIsOpen, isStaff, onReverse }) {
  if (!payments.length) return null;

  return (
    <Table compact unstackable>
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Hora</Table.HeaderCell>
          <Table.HeaderCell>Método</Table.HeaderCell>
          <Table.HeaderCell>Monto</Table.HeaderCell>
          <Table.HeaderCell>Propina</Table.HeaderCell>
          <Table.HeaderCell>Cobró</Table.HeaderCell>
          <Table.HeaderCell />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {payments.map((payment) => (
          <Table.Row key={payment.id} negative={Boolean(payment.reverses)} disabled={payment.is_reversed}>
            <Table.Cell>{formatDateTime(payment.created_at)}</Table.Cell>
            <Table.Cell>
              {payment.method_label}
              {payment.reverses && (
                <Label size="mini" color="red" title={payment.reason}>
                  Anulación
                </Label>
              )}
              {payment.is_reversed && (
                <Label size="mini" basic>
                  Anulado
                </Label>
              )}
            </Table.Cell>
            <Table.Cell>{formatMoney(payment.amount)}</Table.Cell>
            <Table.Cell>{formatMoney(payment.tip)}</Table.Cell>
            <Table.Cell>{payment.created_by_name}</Table.Cell>
            <Table.Cell textAlign="right">
              {canReversePayment(payment, { billIsOpen, isStaff }) && (
                <Button size="mini" basic negative onClick={() => onReverse(payment)}>
                  Anular
                </Button>
              )}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
