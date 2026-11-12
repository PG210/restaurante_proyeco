import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { reportsApi } from "../../../api/reports";
import { ADMIN_SECTIONS, canAccessSection } from "../../../utils/adminSections";
import { PERMISSIONS } from "../../../utils/permissions";
import { INVERTED_RANGE_MESSAGE } from "../../../utils/reportRange";
import { saveFile } from "../../../utils/salesReports";
import { ReportsAdmin } from "../ReportsAdmin";

jest.mock("../../../api/reports", () => ({
  reportsApi: { sales: jest.fn(), downloadSales: jest.fn() },
}));
jest.mock("../../../utils/salesReports", () => ({
  ...jest.requireActual("../../../utils/salesReports"),
  saveFile: jest.fn(),
}));

const RANGE = { first: "2026-11-05", last: "2026-11-11", today: "2026-11-11" };

const PRODUCTS = {
  range: RANGE,
  total: "29500.00",
  units: 4,
  products: [
    { product_id: 1, name: "Café", category: "Bebidas", units: 3, amount: "9500.00", share: "32.2" },
    { product_id: 2, name: "Hamburguesa", category: "Platos", units: 1, amount: "20000.00", share: "67.8" },
  ],
  top: [
    { product_id: 1, name: "Café", units: 3 },
    { product_id: 2, name: "Hamburguesa", units: 1 },
  ],
  bottom: [{ product_id: 3, name: "Jugo", units: 0 }],
};

function byHour(busy) {
  return Array.from({ length: 24 }, (_, hour) => ({ hour, orders: busy[hour] ?? 0, amount: "0.00" }));
}

const HOURS = {
  range: RANGE,
  cells: [{ weekday: 5, hour: 21, orders: 2, amount: "7000.00" }],
  by_hour: byHour({ 21: 2 }),
  by_weekday: Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    orders: index === 4 ? 2 : 0,
    amount: index === 4 ? "7000.00" : "0.00",
  })),
};

function renderPage(path = "/admin/reports") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ReportsAdmin />
    </MemoryRouter>,
  );
}

describe("ReportsAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reportsApi.sales.mockImplementation((report) => Promise.resolve(report === "hours" ? HOURS : PRODUCTS));
  });

  it("opens the products report for the default range and shows the dates it used", async () => {
    renderPage();

    const rows = within(await screen.findByRole("table", { name: "Todos los productos" })).getAllByRole("row");
    expect(reportsApi.sales).toHaveBeenCalledWith("products", {});
    expect(within(rows[1]).getByText("Hamburguesa")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Menos vendidos" })).getByText("Jugo")).toBeInTheDocument();
    expect(screen.getByLabelText("Desde")).toHaveValue("2026-11-05");
    expect(screen.getByLabelText("Hasta")).toHaveValue("2026-11-11");
  });

  it("sorts the products by name", async () => {
    renderPage();

    fireEvent.click(await screen.findByText("Producto"));
    fireEvent.click(screen.getByText("Producto"));

    const rows = within(screen.getByRole("table", { name: "Todos los productos" })).getAllByRole("row");
    expect(within(rows[1]).getByText("Café")).toBeInTheDocument();
  });

  it("asks again when the dates or a shortcut change", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Todos los productos" });

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-01" } });
    await waitFor(() =>
      expect(reportsApi.sales).toHaveBeenLastCalledWith("products", { from: "2026-11-01", to: "2026-11-11" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Mes pasado" }));
    await waitFor(() =>
      expect(reportsApi.sales).toHaveBeenLastCalledWith("products", { from: "2026-10-01", to: "2026-10-31" }),
    );
  });

  it("does not ask for an inverted range", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Todos los productos" });
    const calls = reportsApi.sales.mock.calls.length;

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-11-20" } });

    expect(screen.getByText(INVERTED_RANGE_MESSAGE)).toBeInTheDocument();
    expect(reportsApi.sales).toHaveBeenCalledTimes(calls);
  });

  it("switches tabs keeping the range from the link", async () => {
    renderPage("/admin/reports?from=2026-11-01&to=2026-11-07");
    await screen.findByRole("table", { name: "Todos los productos" });

    fireEvent.click(screen.getByRole("button", { name: "Horas" }));

    expect(await screen.findByLabelText("Viernes 21:00: 2 pedidos, $7000.00")).toHaveTextContent("2");
    expect(reportsApi.sales).toHaveBeenLastCalledWith("hours", { from: "2026-11-01", to: "2026-11-07" });
  });

  it("downloads the open report as CSV", async () => {
    const blob = new Blob(["x"]);
    reportsApi.downloadSales.mockResolvedValue({ blob, filename: "reporte-horas.csv" });
    renderPage("/admin/reports?tab=hours");
    await screen.findByRole("table", { name: "Pedidos por día y hora" });

    fireEvent.click(screen.getByRole("button", { name: "Descargar CSV" }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(blob, "reporte-horas.csv"));
    expect(reportsApi.downloadSales).toHaveBeenCalledWith("hours", {}, "csv");
  });

  it("downloads the open report as Excel", async () => {
    const blob = new Blob(["x"]);
    reportsApi.downloadSales.mockResolvedValue({ blob, filename: "reporte-productos.xlsx" });
    renderPage("/admin/reports?from=2026-11-01&to=2026-11-07");
    await screen.findByRole("table", { name: "Todos los productos" });

    fireEvent.click(screen.getByRole("button", { name: "Descargar Excel" }));

    await waitFor(() => expect(saveFile).toHaveBeenCalledWith(blob, "reporte-productos.xlsx"));
    expect(reportsApi.downloadSales).toHaveBeenCalledWith("products", { from: "2026-11-01", to: "2026-11-07" }, "xlsx");
  });

  it("is only for the admin", () => {
    const cashier = { is_staff: false, permissions: [PERMISSIONS.VIEW_PAYMENTS, PERMISSIONS.CLOSE_CASH_REGISTER] };

    expect(canAccessSection(ADMIN_SECTIONS.reports, cashier)).toBe(false);
    expect(canAccessSection(ADMIN_SECTIONS.reports, { is_staff: true })).toBe(true);
  });
});
