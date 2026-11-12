import React from "react";
import { render, screen, within } from "@testing-library/react";
import { EMPTY_REPORT_MESSAGE } from "../../../../utils/salesReports";
import { CancellationsReport, NO_CANCELLATIONS_MESSAGE } from "../CancellationsReport";
import { CategoriesReport } from "../CategoriesReport";
import { StaffReport } from "../StaffReport";

const RANGE = { first: "2026-11-05", last: "2026-11-11", today: "2026-11-11" };

describe("sales report views", () => {
  it("shows each category with its share and the total", () => {
    render(
      <CategoriesReport
        data={{
          range: RANGE,
          total: "13000.00",
          categories: [{ category_id: 1, name: "Bebidas", units: 3, amount: "10000.00", share: "76.9" }],
        }}
      />,
    );

    const row = within(screen.getByRole("table", { name: "Consumo por categoría" })).getByRole("row", { name: /Bebidas/ });
    expect(within(row).getByText("$10000.00")).toBeInTheDocument();
    expect(within(row).getByText("76.9 %")).toBeInTheDocument();
    expect(screen.getByText("$13000.00")).toBeInTheDocument();
  });

  it("says when there is nothing in the range", () => {
    render(<CategoriesReport data={{ range: RANGE, total: "0.00", categories: [] }} />);

    expect(screen.getByText(EMPTY_REPORT_MESSAGE)).toBeInTheDocument();
  });

  it("credits orders to who placed them and tips to who charged", () => {
    render(
      <StaffReport
        data={{
          range: RANGE,
          total: "27000.00",
          staff: [
            { user_id: 7, name: "Ana Mesa", amount: "23000.00", share: "85.2", lines: 2, bills: 1 },
            { user_id: null, name: "Cliente (carta QR)", amount: "4000.00", share: "14.8", lines: 1, bills: 1 },
          ],
          tips: [{ user_id: 9, name: "Caja Uno", tips: "500.00", payments: 2 }],
        }}
      />,
    );

    expect(within(screen.getByRole("table", { name: "Pedidos cargados por" })).getByText("Cliente (carta QR)")).toBeInTheDocument();
    const tips = within(screen.getByRole("table", { name: "Propinas por quien cobró" })).getByRole("row", { name: /Caja Uno/ });
    expect(within(tips).getByText("$500.00")).toBeInTheDocument();
  });

  it("groups cancellations by reason and lists the latest ones", () => {
    render(
      <CancellationsReport
        data={{
          range: RANGE,
          count: 3,
          units: 4,
          amount: "29000.00",
          by_reason: [{ reason: "Se demoró", count: 2, units: 3, amount: "9000.00" }],
          by_product: [{ product_id: 1, name: "Café", count: 2, units: 3, amount: "9000.00" }],
          latest: [
            {
              id: 5,
              created_at: "2026-11-11T21:00:00Z",
              table_number: 4,
              product: "Café",
              quantity: 2,
              amount: "6000.00",
              reason: "Se demoró",
              placed_by: "Ana Mesa",
            },
          ],
        }}
      />,
    );

    expect(within(screen.getByRole("table", { name: "Por motivo" })).getByText("Se demoró")).toBeInTheDocument();
    const latest = within(screen.getByRole("table", { name: "Últimas cancelaciones" })).getAllByRole("row")[1];
    expect(within(latest).getByText("2 × Café")).toBeInTheDocument();
    expect(within(latest).getByText("Ana Mesa")).toBeInTheDocument();
  });

  it("says when nothing was cancelled", () => {
    render(
      <CancellationsReport
        data={{ range: RANGE, count: 0, units: 0, amount: "0.00", by_reason: [], by_product: [], latest: [] }}
      />,
    );

    expect(screen.getByText(NO_CANCELLATIONS_MESSAGE)).toBeInTheDocument();
  });
});
