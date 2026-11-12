import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PERMISSIONS } from "../../../../utils/permissions";
import { ATTEND_WAITER_LABEL, TableControls } from "../TableControls/TableControls";

const WAITER = {
  is_staff: false,
  permissions: [PERMISSIONS.VIEW_ORDER, PERMISSIONS.OPEN_TABLE, PERMISSIONS.ATTEND_BILL_REQUEST],
};
const COOK = { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER, PERMISSIONS.PREPARE_ORDER] };
const CLOSED_TABLE = { id: 1, number: 5, is_open: false, bill_requested: false };
const OPEN_TABLE_WITH_BILL = { ...CLOSED_TABLE, is_open: true, bill_requested: true };

function renderControls(table, user) {
  const handlers = { onOpen: jest.fn(), onClose: jest.fn(), onAttendBill: jest.fn(), onAttendWaiter: jest.fn() };
  render(<TableControls table={table} user={user} busy={false} {...handlers} />);
  return handlers;
}

describe("TableControls", () => {
  it("lets a waiter open a closed table", () => {
    const { onOpen } = renderControls(CLOSED_TABLE, WAITER);

    fireEvent.click(screen.getByRole("button", { name: "Abrir mesa" }));

    expect(onOpen).toHaveBeenCalled();
    expect(screen.getByText("Cerrada")).toBeInTheDocument();
  });

  it("lets a waiter close an open table", () => {
    const { onClose } = renderControls(OPEN_TABLE_WITH_BILL, WAITER);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar mesa" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("shows the bill request and lets the waiter attend it", () => {
    const { onAttendBill } = renderControls(OPEN_TABLE_WITH_BILL, WAITER);

    expect(screen.getByText("Pide la cuenta")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cuenta atendida" }));
    expect(onAttendBill).toHaveBeenCalled();
  });

  it("shows the waiter call and lets the waiter attend it", () => {
    const { onAttendWaiter } = renderControls({ ...OPEN_TABLE_WITH_BILL, waiter_called: true }, WAITER);

    expect(screen.getByText("Llama al mesero")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ATTEND_WAITER_LABEL }));
    expect(onAttendWaiter).toHaveBeenCalled();
  });

  it("shows the table state to a cook but no actions", () => {
    renderControls({ ...OPEN_TABLE_WITH_BILL, waiter_called: true }, COOK);

    expect(screen.getByText("Abierta")).toBeInTheDocument();
    expect(screen.getByText("Llama al mesero")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
