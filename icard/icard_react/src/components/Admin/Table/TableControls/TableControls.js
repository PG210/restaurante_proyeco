import React from "react";
import { Button, Label } from "semantic-ui-react";
import "./TableControls.scss";
import { PERMISSIONS, hasPermission } from "../../../../utils/permissions";
import { WAITER_CALLED_TEXT } from "../../../../utils/tableStatus";

export const ATTEND_WAITER_LABEL = "Mesero atendido";

export function TableControls({ table, user, onOpen, onClose, onAttendBill, onAttendWaiter, busy }) {
  const canOpenTables = hasPermission(user, PERMISSIONS.OPEN_TABLE);
  const canAttendBills = hasPermission(user, PERMISSIONS.ATTEND_BILL_REQUEST);

  return (
    <div className="table-controls">
      <Label color={table.is_open ? "green" : "grey"}>{table.is_open ? "Abierta" : "Cerrada"}</Label>
      {table.waiter_called && <Label color="yellow" icon="bell" content={WAITER_CALLED_TEXT} />}
      {table.bill_requested && <Label color="red">Pide la cuenta</Label>}

      <div className="table-controls__actions">
        {table.waiter_called && canAttendBills && (
          <Button size="small" color="yellow" disabled={busy} onClick={onAttendWaiter}>
            {ATTEND_WAITER_LABEL}
          </Button>
        )}
        {table.bill_requested && canAttendBills && (
          <Button size="small" color="red" disabled={busy} onClick={onAttendBill}>
            Cuenta atendida
          </Button>
        )}
        {canOpenTables && !table.is_open && (
          <Button size="small" positive disabled={busy} onClick={onOpen}>
            Abrir mesa
          </Button>
        )}
        {canOpenTables && table.is_open && (
          <Button size="small" basic disabled={busy} onClick={onClose}>
            Cerrar mesa
          </Button>
        )}
      </div>
    </div>
  );
}
