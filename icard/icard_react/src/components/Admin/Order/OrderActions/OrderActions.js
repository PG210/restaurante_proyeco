import React from "react";
import { Button } from "semantic-ui-react";
import { ADVANCE_ACTION_LABELS, canAdvanceOrder, getNextStatus, isOpenStatus } from "../../../../utils/orderStatus";
import { PERMISSIONS, hasPermission } from "../../../../utils/permissions";

export function OrderActions({ order, user, onAdvance, onCancel }) {
  const canCancel = Boolean(onCancel) && isOpenStatus(order.status) && hasPermission(user, PERMISSIONS.CANCEL_ORDER);

  return (
    <>
      {canAdvanceOrder(order, user) && (
        <Button size="small" primary onClick={() => onAdvance(order)}>
          {ADVANCE_ACTION_LABELS[getNextStatus(order.status)]}
        </Button>
      )}
      {canCancel && (
        <Button size="small" negative basic onClick={() => onCancel(order)}>
          Cancelar
        </Button>
      )}
    </>
  );
}
