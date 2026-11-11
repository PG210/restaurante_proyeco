import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ORDER_STATUS } from "../../../../utils/orderStatus";
import { KitchenBoard, groupOrdersByStatus } from "../KitchenBoard/KitchenBoard";

const ORDERS = [
  { id: 1, status: ORDER_STATUS.PENDING },
  { id: 2, status: ORDER_STATUS.READY },
  { id: 3, status: ORDER_STATUS.PENDING },
  { id: 4, status: ORDER_STATUS.DELIVERED },
];

const CREATED_AT = "2026-11-09T12:00:00Z";
const NOW = new Date(CREATED_AT).getTime() + 125 * 60000;
const COOK = { is_staff: false, permissions: [] };

function kitchenOrder(id, notes = "") {
  return {
    id,
    status: ORDER_STATUS.PENDING,
    quantity: 2,
    notes,
    created_at: CREATED_AT,
    product_data: { title: "Sopa de pollo" },
    table_data: { number: 4 },
  };
}

function renderBoard(orders) {
  render(<KitchenBoard orders={orders} user={COOK} now={NOW} onAdvance={jest.fn()} />);
}

describe("groupOrdersByStatus", () => {
  it("creates the columns in kitchen order", () => {
    expect(groupOrdersByStatus(ORDERS).map((column) => column.status)).toEqual([
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PREPARING,
      ORDER_STATUS.READY,
    ]);
  });

  it("keeps the arrival order inside a column", () => {
    const [pending] = groupOrdersByStatus(ORDERS);

    expect(pending.orders.map((order) => order.id)).toEqual([1, 3]);
  });

  it("leaves closed statuses out of the board", () => {
    const shownIds = groupOrdersByStatus(ORDERS).flatMap((column) => column.orders.map((order) => order.id));

    expect(shownIds).not.toContain(4);
  });

  it("returns empty columns before orders load", () => {
    expect(groupOrdersByStatus(null).every((column) => column.orders.length === 0)).toBe(true);
  });
});

describe("KitchenBoard card", () => {
  it("shows the waiting time in hours and minutes", () => {
    renderBoard([kitchenOrder(1)]);

    expect(screen.getByText("Mesa 4 · 2 h 5 min")).toBeInTheDocument();
  });

  it("keeps the note collapsed until the cook opens it", () => {
    renderBoard([kitchenOrder(1, "Una con cerdo y otra con res")]);

    expect(screen.queryByText("Una con cerdo y otra con res")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    expect(screen.getByText("Una con cerdo y otra con res")).toBeInTheDocument();
  });

  it("collapses the note again", () => {
    renderBoard([kitchenOrder(1, "Sin cebolla")]);

    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocultar nota" }));

    expect(screen.queryByText("Sin cebolla")).not.toBeInTheDocument();
  });

  it("opens each card's note independently", () => {
    renderBoard([kitchenOrder(1, "Sin cebolla"), kitchenOrder(2, "Extra picante")]);

    fireEvent.click(screen.getAllByRole("button", { name: "Ver nota" })[0]);

    expect(screen.getByText("Sin cebolla")).toBeInTheDocument();
    expect(screen.queryByText("Extra picante")).not.toBeInTheDocument();
  });

  it("does not show the note button when the order has no note", () => {
    renderBoard([kitchenOrder(1)]);

    expect(screen.queryByRole("button", { name: "Ver nota" })).not.toBeInTheDocument();
  });
});

describe("KitchenBoard preparation time", () => {
  it("shows the estimate and how late the order is", () => {
    renderBoard([{ ...kitchenOrder(1), preparation_minutes: 120 }]);

    expect(screen.getByText("Mesa 4 · 2 h 5 min · Estimado: 2 h · +5 min")).toBeInTheDocument();
  });

  it("shows no delay for a slow dish that is still within its time", () => {
    renderBoard([{ ...kitchenOrder(1), preparation_minutes: 180 }]);

    expect(screen.getByText("Mesa 4 · 2 h 5 min · Estimado: 3 h")).toBeInTheDocument();
  });

  it("counts a prepaid order from when it was paid", () => {
    const paid = new Date(NOW - 2 * 60000).toISOString();
    renderBoard([{ ...kitchenOrder(1), kitchen_at: paid }]);

    expect(screen.getByText("Mesa 4 · 2 min")).toBeInTheDocument();
  });
});
