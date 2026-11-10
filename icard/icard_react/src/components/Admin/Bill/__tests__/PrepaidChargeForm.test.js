import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { billApi } from "../../../../api/bill";
import { BillPanel, billStatistics } from "../BillPanel/BillPanel";
import { PrepaidChargeForm } from "../PrepaidChargeForm/PrepaidChargeForm";
import { MemoryRouter } from "react-router-dom";

jest.mock("../../../../api/bill", () => ({
  billApi: { charge: jest.fn() },
}));

const PREPAID_BILL = {
  id: 9,
  status: "OPEN",
  payment_mode: "PREPAID",
  tax_type: "INC",
  tax_rate: "8.00",
  orders_in_progress: false,
  payments: [],
  totals: { subtotal: "35000.00", paid: "0.00", tips: "0.00", balance: "35000.00", tax_base: "32407.41", tax: "2592.59" },
  lines: [
    { id: 1, product_title: "Bandeja", quantity: 1, line_total: "30000.00", status: "AWAITING_PAYMENT", is_paid: false },
    { id: 2, product_title: "Limonada", quantity: 1, line_total: "5000.00", status: "AWAITING_PAYMENT", is_paid: false },
  ],
};

const CASHIER = { is_staff: false, permissions: ["view_order", "charge_bill"] };

describe("PrepaidChargeForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    billApi.charge.mockResolvedValue({ ...PREPAID_BILL, lines: [] });
  });

  it("charges every unpaid order by default for their exact total", async () => {
    const onCharged = jest.fn();
    render(<PrepaidChargeForm bill={PREPAID_BILL} onClose={jest.fn()} onCharged={onCharged} />);

    expect(screen.getByText("Total a cobrar: $35000.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cobrar pedidos" }));

    await waitFor(() =>
      expect(billApi.charge).toHaveBeenCalledWith(9, {
        method: "CASH",
        amount: "35000.00",
        tip: "0",
        reference: "",
        orders: [1, 2],
      }),
    );
  });

  it("charges only the orders left checked", async () => {
    render(<PrepaidChargeForm bill={PREPAID_BILL} onClose={jest.fn()} onCharged={jest.fn()} />);

    fireEvent.click(screen.getByLabelText("1 × Limonada — $5000.00"));
    fireEvent.click(screen.getByRole("button", { name: "Cobrar pedidos" }));

    await waitFor(() =>
      expect(billApi.charge).toHaveBeenCalledWith(9, expect.objectContaining({ amount: "30000.00", orders: [1] })),
    );
  });

  it("cannot charge with nothing selected", () => {
    render(<PrepaidChargeForm bill={PREPAID_BILL} onClose={jest.fn()} onCharged={jest.fn()} />);

    fireEvent.click(screen.getByLabelText("1 × Bandeja — $30000.00"));
    fireEvent.click(screen.getByLabelText("1 × Limonada — $5000.00"));

    expect(screen.getByRole("button", { name: "Cobrar pedidos" })).toBeDisabled();
  });
});

describe("BillPanel with tax and prepaid mode", () => {
  it("shows the tax breakdown first", () => {
    expect(billStatistics(PREPAID_BILL).map((statistic) => statistic.label)).toEqual([
      "Base",
      "INC 8 %",
      "Total",
      "Pagado",
      "Propinas",
      "Saldo",
    ]);
  });

  it("hides the tax breakdown when the bill has no tax", () => {
    const labels = billStatistics({ ...PREPAID_BILL, tax_type: "" }).map((statistic) => statistic.label);

    expect(labels).not.toContain("Base");
  });

  it("offers to charge the orders and warns they are not in the kitchen yet", () => {
    render(
      <MemoryRouter>
        <BillPanel bill={PREPAID_BILL} paidBillId={null} user={CASHIER} onCharge={jest.fn()} onReverse={jest.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /Cobrar pedidos/ })).toBeInTheDocument();
    expect(screen.getByText(/La cocina no los verá hasta que se cobren/)).toBeInTheDocument();
  });
});
