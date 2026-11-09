import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ORDER_STATUS } from "../../../../utils/orderStatus";
import { PERMISSIONS } from "../../../../utils/permissions";
import { OrdersTable } from "../OrdersTable/OrdersTable";

const COOK = { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER, PERMISSIONS.PREPARE_ORDER] };
const WAITER = { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER, PERMISSIONS.DELIVER_ORDER] };
const ADMIN = { is_staff: true, permissions: [] };

function buildOrder(id, title, status = ORDER_STATUS.PENDING) {
  return { id, status, quantity: 1, notes: "", price: "1000.00", product_data: { title } };
}

const PENDING_ORDERS = [buildOrder(1, "Helado"), buildOrder(2, "Bebida"), buildOrder(3, "Sopa")];

function renderTable(orders, user, onBulkAdvance = jest.fn().mockResolvedValue(true)) {
  render(
    <OrdersTable orders={orders} user={user} onAdvance={jest.fn()} onBulkAdvance={onBulkAdvance} onCancel={jest.fn()} />,
  );
  return { onBulkAdvance };
}

function selectAll() {
  return screen.getByLabelText("Seleccionar todos");
}

function bulkButton() {
  return screen.getByRole("button", { name: /\(\d+\)$/ });
}

describe("OrdersTable bulk advance", () => {
  it("selects every pending order and sends them to preparation", async () => {
    const { onBulkAdvance } = renderTable(PENDING_ORDERS, COOK);

    fireEvent.click(selectAll());

    expect(bulkButton()).toHaveTextContent("Enviar a preparar (3)");
    fireEvent.click(bulkButton());
    await waitFor(() => expect(bulkButton()).toHaveTextContent("(0)"));
    expect(onBulkAdvance).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("sends only the orders that were checked", async () => {
    const { onBulkAdvance } = renderTable(PENDING_ORDERS, COOK);

    fireEvent.click(screen.getByLabelText("Seleccionar Sopa"));
    fireEvent.click(bulkButton());

    await waitFor(() => expect(bulkButton()).toHaveTextContent("(0)"));
    expect(onBulkAdvance).toHaveBeenCalledWith([3]);
  });

  it("disables the button until something is selected", () => {
    renderTable(PENDING_ORDERS, COOK);

    expect(bulkButton()).toBeDisabled();
  });

  it("clears the selection after a successful send", async () => {
    renderTable(PENDING_ORDERS, COOK);

    fireEvent.click(selectAll());
    fireEvent.click(bulkButton());

    await waitFor(() => expect(bulkButton()).toHaveTextContent("(0)"));
  });

  it("keeps the selection when the send fails", async () => {
    renderTable(PENDING_ORDERS, COOK, jest.fn().mockResolvedValue(false));

    fireEvent.click(selectAll());
    fireEvent.click(bulkButton());

    await waitFor(() => expect(bulkButton()).not.toHaveClass("loading"));
    expect(bulkButton()).toHaveTextContent("(3)");
  });

  it("unselects everything when select all is clicked twice", () => {
    renderTable(PENDING_ORDERS, COOK);

    fireEvent.click(selectAll());
    fireEvent.click(selectAll());

    expect(bulkButton()).toHaveTextContent("(0)");
  });

  it("does not offer selection to a waiter for pending orders", () => {
    renderTable(PENDING_ORDERS, WAITER);

    expect(screen.queryByText("Seleccionar todos")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Seleccionar Helado")).not.toBeInTheDocument();
  });

  it("only lets the user select orders they can advance", () => {
    const orders = [buildOrder(1, "Helado"), buildOrder(2, "Bebida", ORDER_STATUS.READY)];
    renderTable(orders, COOK);

    expect(screen.getByLabelText("Seleccionar Helado")).toBeInTheDocument();
    expect(screen.queryByLabelText("Seleccionar Bebida")).not.toBeInTheDocument();
  });

  it("uses a generic label when the selection mixes statuses", () => {
    const orders = [buildOrder(1, "Helado"), buildOrder(2, "Bebida", ORDER_STATUS.READY)];
    renderTable(orders, ADMIN);

    fireEvent.click(selectAll());

    expect(bulkButton()).toHaveTextContent("Avanzar seleccionados (2)");
  });
});
