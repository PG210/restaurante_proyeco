import React, { useState } from "react";
import { Button, Card, Header, Icon } from "semantic-ui-react";
import "./KitchenBoard.scss";
import {
  KITCHEN_STATUSES,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  formatWaitingTime,
  kitchenTiming,
} from "../../../../utils/orderStatus";
import { OrderActions } from "../OrderActions/OrderActions";
import { modifierSummary } from "../../../../utils/modifiers";

export function groupOrdersByStatus(orders) {
  return KITCHEN_STATUSES.map((status) => ({
    status,
    orders: (orders || []).filter((order) => order.status === status),
  }));
}

export function KitchenBoard({ orders, user, now, onAdvance }) {
  return (
    <div className="kitchen-board">
      {groupOrdersByStatus(orders).map((column) => (
        <div key={column.status} className="kitchen-board__column">
          <Header as="h3" color={ORDER_STATUS_COLORS[column.status]}>
            {ORDER_STATUS_LABELS[column.status]} ({column.orders.length})
          </Header>
          {column.orders.map((order) => (
            <KitchenOrderCard key={order.id} order={order} user={user} now={now} onAdvance={onAdvance} />
          ))}
        </div>
      ))}
    </div>
  );
}

function KitchenOrderCard({ order, user, now, onAdvance }) {
  const { waiting, estimate, overdue, late } = kitchenTiming(order, now);

  return (
    <Card fluid className={late ? "kitchen-board__card kitchen-board__card--late" : "kitchen-board__card"}>
      <Card.Content>
        <Card.Header>
          {order.quantity} × {order.product_data?.title}
        </Card.Header>
        {order.modifiers?.length > 0 && (
          <Card.Description className="kitchen-board__modifiers">{modifierSummary(order.modifiers)}</Card.Description>
        )}
        <Card.Meta>
          Mesa {order.table_data?.number} · {formatWaitingTime(waiting)}
          {estimate !== null && ` · Estimado: ${formatWaitingTime(estimate)}`}
          {overdue > 0 && ` · +${formatWaitingTime(overdue)}`}
        </Card.Meta>
        {order.notes && <OrderNote notes={order.notes} />}
      </Card.Content>
      <Card.Content extra>
        <OrderActions order={order} user={user} onAdvance={onAdvance} />
      </Card.Content>
    </Card>
  );
}

function OrderNote({ notes }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="kitchen-board__note">
      <Button
        type="button"
        size="mini"
        basic
        color="yellow"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <Icon name={expanded ? "caret down" : "caret right"} />
        {expanded ? "Ocultar nota" : "Ver nota"}
      </Button>
      {expanded && <Card.Description className="kitchen-board__note-text">{notes}</Card.Description>}
    </div>
  );
}
