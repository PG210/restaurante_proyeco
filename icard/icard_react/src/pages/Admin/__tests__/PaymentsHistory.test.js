import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { billApi } from "../../../api/bill";
import { startOfLocalDayIso } from "../../../utils/dateRange";
import { BillTicket, billableLines } from "../BillTicket";
import { PaymentsHistory, historyFilters } from "../PaymentsHistory";

jest.mock("../../../api/bill", () => ({
  billApi: { list: jest.fn(), summary: jest.fn(), retrieve: jest.fn() },
}));

const PAID_BILL = {
  id: 4,
  table_number: 5,
  status: "PAID",
  closed_at: "2026-11-10T21:00:00Z",
  closed_by_name: "Caja",
  subtotal: "21.00",
  tip_total: "2.00",
  total_paid: "21.00",
  methods: ["CARD", "CASH"],
};

const SUMMARY = {
  bills: 1,
  total: "21.00",
  tips: "2.00",
  by_method: [
    { method: "CARD", amount: "10.00", tips: "0.00" },
    { method: "CASH", amount: "11.00", tips: "2.00" },
  ],
};

function renderHistory() {
  render(
    <MemoryRouter initialEntries={["/admin/payments-history"]}>
      <Routes>
        <Route path="/admin/payments-history" element={<PaymentsHistory />} />
        <Route path="/admin/bills/:id/ticket" element={<p>Ticket abierto</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("historyFilters", () => {
  it("only asks for paid bills in the local day range", () => {
    expect(historyFilters({ from: "2026-11-10", to: "", tableNumber: "", method: "" })).toEqual({
      status: "PAID",
      closed_at_after: startOfLocalDayIso("2026-11-10"),
      closed_at_before: undefined,
      table_number: undefined,
      method: undefined,
    });
  });

  it("passes table and method filters through", () => {
    const filters = historyFilters({ from: "", to: "", tableNumber: "5", method: "CASH" });

    expect(filters).toMatchObject({ table_number: "5", method: "CASH" });
  });
});

describe("PaymentsHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    billApi.list.mockResolvedValue({ count: 1, results: [PAID_BILL] });
    billApi.summary.mockResolvedValue(SUMMARY);
  });

  it("shows the cash-up totals by method", async () => {
    renderHistory();

    expect(await screen.findByText("Total cobrado")).toBeInTheDocument();
    expect(screen.getByText("$11.00")).toBeInTheDocument();
    expect(screen.getAllByText("Tarjeta").length).toBeGreaterThan(0);
  });

  it("lists paid bills and opens the ticket", async () => {
    renderHistory();

    fireEvent.click(await screen.findByText("Tarjeta, Efectivo"));

    expect(await screen.findByText("Ticket abierto")).toBeInTheDocument();
  });

  it("requests the first page again when a filter changes", async () => {
    renderHistory();
    await screen.findByText("Total cobrado");

    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5" } });

    await waitFor(() =>
      expect(billApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ table_number: "5", page: 1 })),
    );
    await act(() => Promise.resolve());
  });

  it("explains when there are no paid bills", async () => {
    billApi.list.mockResolvedValue({ count: 0, results: [] });

    renderHistory();

    expect(await screen.findByText("No hay cuentas pagadas con estos filtros.")).toBeInTheDocument();
  });
});

describe("BillTicket", () => {
  const TICKET = {
    id: 4,
    table_number: 5,
    status: "PAID",
    opened_at: "2026-11-10T20:00:00Z",
    closed_at: "2026-11-10T21:00:00Z",
    closed_by_name: "Caja",
    totals: { subtotal: "21.00", paid: "21.00", tips: "2.00", balance: "0.00" },
    lines: [
      { id: 1, product_title: "Sopa", quantity: 1, price: "12.00", line_total: "12.00", status: "DELIVERED" },
      { id: 2, product_title: "Helado", quantity: 2, price: "4.50", line_total: "9.00", status: "DELIVERED" },
      { id: 3, product_title: "Flan", quantity: 1, price: "3.00", line_total: "3.00", status: "CANCELLED" },
    ],
    payments: [{ id: 1, method_label: "Efectivo", amount: "21.00", reverses: null }],
  };

  it("leaves cancelled orders out of the ticket", () => {
    expect(billableLines(TICKET.lines).map((line) => line.product_title)).toEqual(["Sopa", "Helado"]);
  });

  it("prints the lines, totals and payments", async () => {
    billApi.retrieve.mockResolvedValue(TICKET);
    render(
      <MemoryRouter initialEntries={["/admin/bills/4/ticket"]}>
        <Routes>
          <Route path="/admin/bills/:id/ticket" element={<BillTicket />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("2 × Helado")).toBeInTheDocument();
    expect(screen.queryByText(/Flan/)).not.toBeInTheDocument();
    expect(screen.getByText("Total pagado")).toBeInTheDocument();
    expect(billApi.retrieve).toHaveBeenCalledWith("4");
  });

  it("marks an open bill as not valid as a receipt", async () => {
    billApi.retrieve.mockResolvedValue({ ...TICKET, status: "OPEN", closed_at: null });
    render(
      <MemoryRouter initialEntries={["/admin/bills/4/ticket"]}>
        <Routes>
          <Route path="/admin/bills/:id/ticket" element={<BillTicket />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/NO VÁLIDO COMO COMPROBANTE/)).toBeInTheDocument();
  });
});
