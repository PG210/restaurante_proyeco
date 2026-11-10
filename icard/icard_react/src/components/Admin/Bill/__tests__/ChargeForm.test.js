import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "../../../../api/client";
import { billApi } from "../../../../api/bill";
import { ChargeForm } from "../ChargeForm/ChargeForm";

jest.mock("../../../../api/bill", () => ({
  billApi: { charge: jest.fn() },
}));

const BILL = { id: 8, totals: { subtotal: "21.30", paid: "0.00", tips: "0.00", balance: "21.30" } };

function renderForm() {
  const handlers = { onClose: jest.fn(), onCharged: jest.fn() };
  render(<ChargeForm bill={BILL} {...handlers} />);
  return handlers;
}

function setField(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
}

function chooseMethod(label) {
  fireEvent.click(screen.getByRole("listbox"));
  fireEvent.click(screen.getByRole("option", { name: label }));
}

describe("ChargeForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("charges the whole balance in cash by default", async () => {
    const paidBill = { ...BILL, status: "PAID" };
    billApi.charge.mockResolvedValue(paidBill);
    const { onCharged, onClose } = renderForm();

    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(billApi.charge).toHaveBeenCalledWith(8, { method: "CASH", amount: "21.30", tip: "0", reference: "" });
    expect(onCharged).toHaveBeenCalledWith(paidBill);
  });

  it("registers a partial payment with tip", async () => {
    billApi.charge.mockResolvedValue(BILL);
    renderForm();

    setField("Monto", "10");
    setField("Propina (opcional)", "1.50");
    submit();

    await waitFor(() =>
      expect(billApi.charge).toHaveBeenCalledWith(8, { method: "CASH", amount: "10", tip: "1.50", reference: "" }),
    );
  });

  it("rejects an amount above the balance", async () => {
    renderForm();

    setField("Monto", "21.31");
    submit();

    expect(await screen.findByText("No puede superar el saldo ($21.30)")).toBeInTheDocument();
    expect(billApi.charge).not.toHaveBeenCalled();
  });

  it("rejects more than two decimals", async () => {
    renderForm();

    setField("Monto", "1.005");
    submit();

    expect(await screen.findByText("Usa un número con hasta 2 decimales")).toBeInTheDocument();
    expect(billApi.charge).not.toHaveBeenCalled();
  });

  it("rejects a zero amount", async () => {
    renderForm();

    setField("Monto", "0");
    submit();

    expect(await screen.findByText("El monto debe ser mayor que 0")).toBeInTheDocument();
  });

  it("shows the change for a cash payment", () => {
    renderForm();

    setField("Recibido en efectivo (opcional)", "50");

    expect(screen.getByText("Vuelto: $28.70")).toBeInTheDocument();
  });

  it("asks for a reference and sends it for card payments", async () => {
    billApi.charge.mockResolvedValue(BILL);
    renderForm();

    chooseMethod("Tarjeta");
    setField("Referencia (voucher o transferencia)", "  VOUCHER-77 ");
    submit();

    await waitFor(() =>
      expect(billApi.charge).toHaveBeenCalledWith(8, {
        method: "CARD",
        amount: "21.30",
        tip: "0",
        reference: "VOUCHER-77",
      }),
    );
    expect(screen.queryByLabelText("Recibido en efectivo (opcional)")).not.toBeInTheDocument();
  });

  it("keeps the form open when the API rejects the payment", async () => {
    billApi.charge.mockRejectedValue(new ApiError("Hay pedidos sin entregar.", 400));
    const { onClose, onCharged } = renderForm();

    submit();

    await waitFor(() => expect(billApi.charge).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Registrar pago" })).not.toHaveClass("loading"));
    expect(onClose).not.toHaveBeenCalled();
    expect(onCharged).not.toHaveBeenCalled();
  });
});
