import React from "react";
import { Label } from "semantic-ui-react";
import { ReactComponent as IcTable } from "../../../../assets/comedor.svg";
import "./TableAdmin.scss";
import { getTableState, getTableSummaryLabels } from "../../../../utils/orderStatus";

export function TableAdmin({ table, onSelect }) {
  return (
    <button type="button" className={`table-admin table-admin--${getTableState(table)}`} onClick={() => onSelect(table)}>
      <IcTable />
      <p>Mesa {table.number}</p>
      <div className="table-admin__labels">
        {getTableSummaryLabels(table).map((label) => (
          <Label key={label.status} color={label.color}>
            {label.text}
          </Label>
        ))}
      </div>
    </button>
  );
}
