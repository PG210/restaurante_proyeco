import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { TableAdmin } from "../TableAdmin/TableAdmin";

const CLOSED_TABLE = { id: 3, number: 5, is_open: false, bill_requested: false, pending: 0, preparing: 0, ready: 0 };
const OPEN_TABLE = { ...CLOSED_TABLE, is_open: true, pending: 2 };

function renderTable(table, props = {}) {
  const handlers = { onSelect: jest.fn(), onToggleOpen: jest.fn() };
  render(<TableAdmin table={table} {...handlers} {...props} />);
  return handlers;
}

describe("TableAdmin", () => {
  it("lets a user who can open tables switch on a closed table from the card", () => {
    const { onToggleOpen } = renderTable(CLOSED_TABLE, { canToggleOpen: true });

    fireEvent.click(screen.getByLabelText("Cerrada"));

    expect(onToggleOpen).toHaveBeenCalledWith(CLOSED_TABLE);
  });

  it("shows the switch on for an open table", () => {
    renderTable(OPEN_TABLE, { canToggleOpen: true });

    expect(screen.getByLabelText("Abierta")).toBeChecked();
  });

  it("does not repeat the closed badge next to the switch", () => {
    renderTable(CLOSED_TABLE, { canToggleOpen: true });

    expect(screen.getAllByText("Cerrada")).toHaveLength(1);
  });

  it("shows only the closed badge to users who cannot open tables", () => {
    renderTable(CLOSED_TABLE);

    expect(screen.getByText("Cerrada")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("disables the switch while the change is being saved", () => {
    renderTable(CLOSED_TABLE, { canToggleOpen: true, toggling: true });

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("opens the table detail without toggling it", () => {
    const { onSelect, onToggleOpen } = renderTable(OPEN_TABLE, { canToggleOpen: true });

    fireEvent.click(screen.getByRole("button", { name: "Ver mesa 5" }));

    expect(onSelect).toHaveBeenCalledWith(OPEN_TABLE);
    expect(onToggleOpen).not.toHaveBeenCalled();
  });
});
