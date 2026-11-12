import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TableTablesAdmin } from "../TableTablesAdmin/TableTablesAdmin";
import { kitchenAlertKeys } from "../../../../pages/Admin/KitchenAdmin";

const TABLES = [
  { id: 1, number: 4, is_open: true, bill_requested: true, waiter_called: true },
  { id: 2, number: 5, is_open: true, bill_requested: false, waiter_called: false },
];

describe("tables list", () => {
  it("rings a bell on the tables calling the waiter and opens the table from it", () => {
    const onShowTable = jest.fn();
    render(
      <TableTablesAdmin
        tables={TABLES}
        updateTable={jest.fn()}
        onDeleteTable={jest.fn()}
        onShowQr={jest.fn()}
        onShowTable={onShowTable}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mesa 4 llama al mesero" }));

    expect(onShowTable).toHaveBeenCalledWith(TABLES[0]);
    expect(screen.queryByRole("button", { name: "Mesa 5 llama al mesero" })).not.toBeInTheDocument();
    const calling = screen.getAllByRole("row")[1];
    expect(within(calling).getByText("Pide la cuenta")).toBeInTheDocument();
  });
});

describe("kitchen alerts", () => {
  it("only watches the orders waiting in Pendientes", () => {
    const orders = [
      { id: 7, status: "PENDING" },
      { id: 8, status: "PREPARING" },
      { id: 9, status: "PENDING" },
    ];

    expect(kitchenAlertKeys(orders)).toEqual(["7", "9"]);
  });
});
