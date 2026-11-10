import React from "react";
import { Button, Checkbox, Icon } from "semantic-ui-react";
import "./TableListAdmin.scss";
import { TableAdmin } from "../TableAdmin";

export function TableListAdmin({
  tables,
  onReload,
  autoReload,
  onToggleAutoReload,
  onSelectTable,
  canToggleOpen,
  togglingTableId,
  onToggleOpen,
}) {
  return (
    <div className="tables-list-admin">
      <Button icon primary className="tables-list-admin__reload" aria-label="Recargar mesas" onClick={onReload}>
        <Icon name="refresh" />
      </Button>

      <div className="tables-list-admin__reload-toggle">
        <span>Recarga automática</span>
        <Checkbox toggle checked={autoReload} onChange={(_, data) => onToggleAutoReload(data.checked)} />
      </div>

      {(tables || []).map((table) => (
        <TableAdmin
          key={table.id}
          table={table}
          onSelect={onSelectTable}
          canToggleOpen={canToggleOpen}
          toggling={togglingTableId === table.id}
          onToggleOpen={onToggleOpen}
        />
      ))}
    </div>
  );
}
