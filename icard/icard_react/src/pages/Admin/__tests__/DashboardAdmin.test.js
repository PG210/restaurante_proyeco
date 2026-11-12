import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { reportsApi } from "../../../api/reports";
import { ADMIN_SECTIONS, canAccessSection } from "../../../utils/adminSections";
import { PERMISSIONS } from "../../../utils/permissions";
import { DashboardAdmin } from "../DashboardAdmin";

jest.mock("../../../api/reports", () => ({
  reportsApi: { dashboard: jest.fn() },
}));

function sales(overrides = {}) {
  return {
    total: "120000.00",
    previous_total: "100000.00",
    change_percent: "20.0",
    tips: "8000.00",
    bills: 6,
    average_ticket: "20000.00",
    ...overrides,
  };
}

const DATA = {
  service_day: "2026-11-11",
  sales: { today: sales(), week: sales({ change_percent: "-5.0" }), month: sales({ change_percent: null }) },
  open_tables: 3,
  tables: 10,
  orders_in_kitchen: 4,
  cash_register: { closed: false },
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardAdmin />
    </MemoryRouter>,
  );
}

describe("DashboardAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reportsApi.dashboard.mockResolvedValue(DATA);
  });

  it("shows sales of each period compared with the previous one", async () => {
    renderDashboard();

    const today = await screen.findByRole("region", { name: "Hoy" });
    expect(within(today).getByText("$120000.00")).toBeInTheDocument();
    expect(within(today).getByText("+20.0 % frente a el mismo día de la semana pasada")).toBeInTheDocument();
    expect(within(today).getByText("$20000.00")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Esta semana" })).getByText(/^-5.0 %/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Este mes" })).getByText("Sin ventas en los mismos días del mes pasado"),
    ).toBeInTheDocument();
  });

  it("shows what is happening now and links to the cash closing", async () => {
    renderDashboard();

    const now = await screen.findByRole("region", { name: "Ahora" });
    expect(within(now).getByText("3 de 10")).toBeInTheDocument();
    expect(within(now).getByText("Sin cerrar")).toBeInTheDocument();
    expect(within(now).getByRole("link", { name: "Cerrar la caja" })).toHaveAttribute("href", "/admin/cash-closing");
  });

  it("warns about payments taken after the cash closing", async () => {
    reportsApi.dashboard.mockResolvedValue({
      ...DATA,
      cash_register: {
        closed: true,
        closed_at: "2026-11-12T04:40:00Z",
        closed_by_name: "Caja Uno",
        payments_after: 2,
      },
    });
    renderDashboard();

    expect(await screen.findByText("2 cobros después del cierre de caja. Revisa la caja.")).toBeInTheDocument();
    expect(screen.getByText("Cerrada")).toBeInTheDocument();
  });

  it("is only for the admin", () => {
    const cashier = { is_staff: false, permissions: [PERMISSIONS.VIEW_PAYMENTS, PERMISSIONS.CLOSE_CASH_REGISTER] };

    expect(canAccessSection(ADMIN_SECTIONS.dashboard, cashier)).toBe(false);
    expect(canAccessSection(ADMIN_SECTIONS.dashboard, { is_staff: true })).toBe(true);
    expect(canAccessSection(ADMIN_SECTIONS.cashClosing, cashier)).toBe(true);
    expect(canAccessSection(ADMIN_SECTIONS.cashClosing, { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER] })).toBe(
      false,
    );
  });
});
