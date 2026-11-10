import React from "react";
import { Checkbox, Label } from "semantic-ui-react";
import { ReactComponent as IcTable } from "../../../../assets/comedor.svg";
import "./TableAdmin.scss";
import { getTableState } from "../../../../utils/orderStatus";
import { getTableBadges } from "../../../../utils/tableStatus";

export function TableAdmin({ table, onSelect, canToggleOpen = false, toggling = false, onToggleOpen }) {
  const closedClass = table.is_open ? "" : " table-admin--closed";
  const badges = getTableBadges(table, { includeClosed: !canToggleOpen });

  return (
    <div className={`table-admin table-admin--${getTableState(table)}${closedClass}`}>
      <button
        type="button"
        className="table-admin__detail"
        aria-label={`Ver mesa ${table.number}`}
        onClick={() => onSelect(table)}
      >
        <IcTable />
        <p>Mesa {table.number}</p>
        <div className="table-admin__labels">
          {badges.map((badge) => (
            <Label key={badge.key} color={badge.color} basic={badge.basic}>
              {badge.text}
            </Label>
          ))}
        </div>
      </button>

      {canToggleOpen && (
        <Checkbox
          toggle
          id={`table-open-${table.id}`}
          className="table-admin__toggle"
          label={table.is_open ? "Abierta" : "Cerrada"}
          checked={table.is_open}
          disabled={toggling}
          onChange={() => onToggleOpen(table)}
        />
      )}
    </div>
  );
}
