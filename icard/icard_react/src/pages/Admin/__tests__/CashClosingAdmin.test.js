import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { cashClosingApi } from "../../../api/reports";
import { BLIND_COUNT_HINT } from "../../../components/Admin";
import { AuthContext } from "../../../context/AuthContext";
import { PERMISSIONS } from "../../../utils/permissions";
import { NOTE_REQUIRED_MESSAGE } from "../../../utils/reports";
import { CashClosingAdmin } from "../CashClosingAdmin";

jest.mock("../../../api/reports", () => ({
  cashClosingApi: { list: jest.fn(), today: jest.fn(), close: jest.fn(), addNote: jest.fn(), void: jest.fn() },
}));

const ADMIN = { is_staff: true, permissions: [] };
const CASHIER = {
  is_staff: false,
  permissions: [PERMISSIONS.CLOSE_CASH_REGISTER, PERMISSIONS.VIEW_PAYMENTS, PERMISSIONS.CHARGE_BILL],
};
const OPEN_DAY = { service_day: "2026-11-11", closing: null };

function line(method, label, expected, counted) {
  const difference = (Number(counted) - Number(expected)).toFixed(2);
  return { method, method_label: label, expected, counted, difference };
}

function closing(overrides = {}) {
  return {
    id: 4,
    service_day: "2026-11-11",
    opening_float: "100000.00",
    note: "",
    needs_note: true,
    closed_at: "2026-11-12T04:40:00Z",
    closed_by_name: "Caja Uno",
    voided_at: null,
    voided_by_name: null,
    void_reason: "",
    lines: [
      line("CASH", "Efectivo", "133000.00", "132000.00"),
      line("CARD", "Tarjeta", "22000.00", "22000.00"),
      line("TRANSFER", "Transferencia", "0.00", "0.00"),
    ],
    total_difference: "-1000.00",
    ...overrides,
  };
}

function renderPage(user = CASHIER) {
  return render(
    <AuthContext.Provider value={{ auth: { me: user } }}>
      <CashClosingAdmin />
    </AuthContext.Provider>,
  );
}

describe("CashClosingAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cashClosingApi.today.mockResolvedValue(OPEN_DAY);
    cashClosingApi.list.mockResolvedValue({ results: [] });
  });

  it("asks for the count without showing what is expected", async () => {
    renderPage();

    const form = await screen.findByRole("region", { name: "Contar la caja" });
    expect(within(form).getByText(BLIND_COUNT_HINT)).toBeInTheDocument();
    expect(screen.queryByText(/Esperado/)).not.toBeInTheDocument();
    expect(screen.queryByText("$133000.00")).not.toBeInTheDocument();
  });

  it("closes the day and then shows expected, counted and the difference", async () => {
    cashClosingApi.close.mockResolvedValue(closing());
    renderPage();

    fireEvent.change(await screen.findByLabelText("Base inicial en efectivo"), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText("Contado: Efectivo"), { target: { value: "132000" } });
    fireEvent.change(screen.getByLabelText("Contado: Tarjeta"), { target: { value: "22000" } });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar caja" }));

    await waitFor(() =>
      expect(cashClosingApi.close).toHaveBeenCalledWith({
        opening_float: "100000",
        counted: { CASH: "132000", CARD: "22000", TRANSFER: "0" },
        note: "",
      }),
    );
    const result = await screen.findByRole("table", { name: "Resultado del cierre" });
    const cash = within(result).getByRole("row", { name: /Efectivo/ });
    expect(within(cash).getByText("$133000.00")).toBeInTheDocument();
    expect(within(cash).getByText("-$1000.00")).toBeInTheDocument();
    expect(screen.getByText(NOTE_REQUIRED_MESSAGE)).toBeInTheDocument();
  });

  it("adds the note that explains the difference", async () => {
    cashClosingApi.today.mockResolvedValue({ ...OPEN_DAY, closing: closing() });
    cashClosingApi.addNote.mockResolvedValue(closing({ note: "Vuelto mal dado", needs_note: false }));
    renderPage();

    fireEvent.change(await screen.findByLabelText("Nota"), { target: { value: " Vuelto mal dado " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));

    await waitFor(() => expect(cashClosingApi.addNote).toHaveBeenCalledWith(4, "Vuelto mal dado"));
    expect(await screen.findByText("Nota: Vuelto mal dado")).toBeInTheDocument();
    expect(screen.queryByText(NOTE_REQUIRED_MESSAGE)).not.toBeInTheDocument();
  });

  it("does not send amounts that are not money", async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText("Contado: Efectivo"), { target: { value: "12,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar caja" }));

    expect(await screen.findByText("Escribe un monto válido, con hasta 2 decimales.")).toBeInTheDocument();
    expect(cashClosingApi.close).not.toHaveBeenCalled();
  });

  it("lets only the admin void a previous closing, with a reason", async () => {
    const previous = closing({ id: 3, service_day: "2026-11-10", needs_note: false, note: "Ok" });
    cashClosingApi.list.mockResolvedValue({ results: [previous] });
    cashClosingApi.void.mockResolvedValue({ ...previous, voided_at: "2026-11-11T10:00:00Z" });
    renderPage(ADMIN);

    fireEvent.click(await screen.findByRole("button", { name: "Anular cierre del 2026-11-10" }));
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conteo equivocado" } });
    fireEvent.click(screen.getByRole("button", { name: "Anular cierre" }));

    await waitFor(() => expect(cashClosingApi.void).toHaveBeenCalledWith(3, "Conteo equivocado"));
    await waitFor(() => expect(cashClosingApi.list).toHaveBeenCalledTimes(2));
  });

  it("shows the history to the cashier without the void button", async () => {
    cashClosingApi.list.mockResolvedValue({ results: [closing({ id: 3, service_day: "2026-11-10" })] });
    renderPage();

    expect(await screen.findByRole("table", { name: "Cierres anteriores" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Anular cierre/ })).not.toBeInTheDocument();
  });

  it("does not load the history without permission to see payments", async () => {
    renderPage({ is_staff: false, permissions: [PERMISSIONS.CLOSE_CASH_REGISTER] });

    await screen.findByRole("region", { name: "Contar la caja" });
    expect(cashClosingApi.list).not.toHaveBeenCalled();
  });
});
