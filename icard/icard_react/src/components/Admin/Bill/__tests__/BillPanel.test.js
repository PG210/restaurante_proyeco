import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PERMISSIONS } from "../../../../utils/permissions";
import { BillPanel } from "../BillPanel/BillPanel";
import { canReversePayment } from "../PaymentList/PaymentList";

const CASHIER = { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER, PERMISSIONS.CHARGE_BILL] };
const WAITER = { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER] };
const ADMIN = { is_staff: true, permissions: [] };

const PAYMENT = {
  id: 1,
  method: "CARD",
  method_label: "Tarjeta",
  amount: "10.00",
  tip: "1.00",
  reverses: null,
  is_reversed: false,
  created_by_name: "Caja",
  created_at: "2026-11-10T12:00:00Z",
};

const OPEN_BILL = {
  id: 4,
  status: "OPEN",
  orders_in_progress: false,
  totals: { subtotal: "21.00", paid: "10.00", tips: "1.00", balance: "11.00" },
  payments: [PAYMENT],
};

function renderPanel(props) {
  const handlers = { onCharge: jest.fn(), onReverse: jest.fn() };
  render(
    <MemoryRouter>
      <BillPanel paidBillId={null} {...handlers} {...props} />
    </MemoryRouter>,
  );
  return handlers;
}

describe("BillPanel", () => {
  it("shows the balance and lets the cashier charge", () => {
    const { onCharge } = renderPanel({ bill: OPEN_BILL, user: CASHIER });

    expect(screen.getByText("$11.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cobrar/ }));
    expect(onCharge).toHaveBeenCalled();
  });

  it("hides the charge button from a waiter", () => {
    renderPanel({ bill: OPEN_BILL, user: WAITER });

    expect(screen.queryByRole("button", { name: /Cobrar/ })).not.toBeInTheDocument();
  });

  it("warns while there are orders in progress", () => {
    renderPanel({ bill: { ...OPEN_BILL, orders_in_progress: true }, user: CASHIER });

    expect(screen.getByText(/Hay pedidos sin entregar/)).toBeInTheDocument();
  });

  it("lets staff reverse a payment of an open bill", () => {
    const { onReverse } = renderPanel({ bill: OPEN_BILL, user: ADMIN });

    fireEvent.click(screen.getByRole("button", { name: "Anular" }));

    expect(onReverse).toHaveBeenCalledWith(PAYMENT);
  });

  it("does not let the cashier reverse payments", () => {
    renderPanel({ bill: OPEN_BILL, user: CASHIER });

    expect(screen.queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
  });

  it("offers the ticket after the bill is paid", () => {
    renderPanel({ bill: null, paidBillId: 4, user: CASHIER });

    expect(screen.getByText("Cuenta pagada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ver ticket/ })).toHaveAttribute("href", "/admin/bills/4/ticket");
  });

  it("shows nothing when the table has no bill", () => {
    const { container } = render(
      <MemoryRouter>
        <BillPanel bill={null} paidBillId={null} user={CASHIER} onCharge={jest.fn()} onReverse={jest.fn()} />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("canReversePayment", () => {
  const rules = { billIsOpen: true, isStaff: true };

  it("allows reversing an ordinary payment", () => {
    expect(canReversePayment(PAYMENT, rules)).toBe(true);
  });

  it("does not reverse a reversal", () => {
    expect(canReversePayment({ ...PAYMENT, reverses: 9 }, rules)).toBe(false);
  });

  it("does not reverse a payment twice", () => {
    expect(canReversePayment({ ...PAYMENT, is_reversed: true }, rules)).toBe(false);
  });

  it("does not reverse payments of a paid bill", () => {
    expect(canReversePayment(PAYMENT, { ...rules, billIsOpen: false })).toBe(false);
  });
});
