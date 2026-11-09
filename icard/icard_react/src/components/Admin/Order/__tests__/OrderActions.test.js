import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ORDER_STATUS } from "../../../../utils/orderStatus";
import { PERMISSIONS } from "../../../../utils/permissions";
import { OrderActions } from "../OrderActions/OrderActions";

const WAITER = {
  is_staff: false,
  permissions: [PERMISSIONS.VIEW_ORDER, PERMISSIONS.DELIVER_ORDER, PERMISSIONS.CANCEL_ORDER],
};
const COOK = { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER, PERMISSIONS.PREPARE_ORDER] };

function renderActions(status, user, handlers = {}) {
  const order = { id: 1, status };
  const onAdvance = handlers.onAdvance ?? jest.fn();
  const onCancel = handlers.onCancel ?? jest.fn();
  render(<OrderActions order={order} user={user} onAdvance={onAdvance} onCancel={onCancel} />);
  return { order, onAdvance, onCancel };
}

describe("OrderActions", () => {
  it("lets a cook start preparing a pending order", () => {
    const { order, onAdvance } = renderActions(ORDER_STATUS.PENDING, COOK);

    fireEvent.click(screen.getByRole("button", { name: "Preparar" }));

    expect(onAdvance).toHaveBeenCalledWith(order);
  });

  it("does not let a waiter prepare a pending order", () => {
    renderActions(ORDER_STATUS.PENDING, WAITER);

    expect(screen.queryByRole("button", { name: "Preparar" })).not.toBeInTheDocument();
  });

  it("lets a waiter deliver a ready order", () => {
    renderActions(ORDER_STATUS.READY, WAITER);

    expect(screen.getByRole("button", { name: "Entregar" })).toBeInTheDocument();
  });

  it("does not let a cook deliver a ready order", () => {
    renderActions(ORDER_STATUS.READY, COOK);

    expect(screen.queryByRole("button", { name: "Entregar" })).not.toBeInTheDocument();
  });

  it("lets a waiter cancel an open order", () => {
    const { order, onCancel } = renderActions(ORDER_STATUS.PREPARING, WAITER);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalledWith(order);
  });

  it("does not offer cancel without the cancel permission", () => {
    renderActions(ORDER_STATUS.PENDING, COOK);

    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
  });

  it("offers no actions on a delivered order", () => {
    renderActions(ORDER_STATUS.DELIVERED, { is_staff: true, permissions: [] });

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
