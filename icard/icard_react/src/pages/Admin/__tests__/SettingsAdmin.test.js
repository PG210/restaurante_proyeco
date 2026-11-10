import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "../../../api/client";
import { configurationApi } from "../../../api/configuration";
import { SettingsAdmin, activeTaxExample, toSettingsPayload, validateDraft } from "../SettingsAdmin";

jest.mock("../../../api/configuration", () => ({
  configurationApi: { get: jest.fn(), update: jest.fn(), changes: jest.fn() },
}));

const DEFAULT_SETTINGS = {
  charge_inc: false,
  inc_rate: null,
  charge_iva: false,
  iva_rate: null,
  payment_mode: "POSTPAID",
};

function draft(overrides) {
  return { charge_inc: false, inc_rate: "", charge_iva: false, iva_rate: "", payment_mode: "POSTPAID", ...overrides };
}

describe("settings helpers", () => {
  it("requires a rate for an active tax", () => {
    expect(validateDraft(draft({ charge_inc: true }))).toHaveProperty("inc_rate");
  });

  it.each(["0", "100.01", "8.555", "abc"])("rejects %s as a rate", (rate) => {
    expect(validateDraft(draft({ charge_inc: true, inc_rate: rate }))).toHaveProperty("inc_rate");
  });

  it("accepts a valid rate", () => {
    expect(validateDraft(draft({ charge_inc: true, inc_rate: "8" }))).toEqual({});
  });

  it("does not validate the rate of an inactive tax", () => {
    expect(validateDraft(draft({ inc_rate: "abc" }))).toEqual({});
  });

  it("sends empty rates as null", () => {
    expect(toSettingsPayload(draft())).toMatchObject({ inc_rate: null, iva_rate: null });
  });

  it("shows a worked example for the active tax", () => {
    expect(activeTaxExample(draft({ charge_inc: true, inc_rate: "8" }))).toBe(
      "Un plato de $30000.00 → base $27777.78, INC $2222.22, total $30000.00",
    );
  });

  it("shows no example without an active tax", () => {
    expect(activeTaxExample(draft())).toBeNull();
  });
});

describe("SettingsAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configurationApi.get.mockResolvedValue(DEFAULT_SETTINGS);
    configurationApi.changes.mockResolvedValue({ results: [] });
  });

  it("starts with every tax switched off", async () => {
    render(<SettingsAdmin />);

    expect(await screen.findByLabelText("Cobrar INC")).not.toBeChecked();
    expect(screen.getByLabelText("Cobrar IVA")).not.toBeChecked();
    expect(screen.getByText("No se cobra impuesto. El ticket no mostrará desglose.")).toBeInTheDocument();
  });

  it("switches IVA off when INC is switched on", async () => {
    configurationApi.get.mockResolvedValue({ ...DEFAULT_SETTINGS, charge_iva: true, iva_rate: "19.00" });
    render(<SettingsAdmin />);

    fireEvent.click(await screen.findByLabelText("Cobrar INC"));

    expect(screen.getByLabelText("Cobrar INC")).toBeChecked();
    expect(screen.getByLabelText("Cobrar IVA")).not.toBeChecked();
  });

  it("saves INC with the rate typed by the administrator", async () => {
    configurationApi.update.mockResolvedValue({ ...DEFAULT_SETTINGS, charge_inc: true, inc_rate: "8.00" });
    render(<SettingsAdmin />);

    fireEvent.click(await screen.findByLabelText("Cobrar INC"));
    fireEvent.change(screen.getByLabelText("Tarifa INC (%)"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));

    await waitFor(() =>
      expect(configurationApi.update).toHaveBeenCalledWith({
        charge_inc: true,
        inc_rate: "8",
        charge_iva: false,
        iva_rate: null,
        payment_mode: "POSTPAID",
      }),
    );
    await waitFor(() => expect(configurationApi.changes).toHaveBeenCalledTimes(2));
  });

  it("does not save an active tax without a rate", async () => {
    render(<SettingsAdmin />);

    fireEvent.click(await screen.findByLabelText("Cobrar INC"));
    fireEvent.change(screen.getByLabelText("Tarifa INC (%)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));

    expect(await screen.findByText(/Escribe una tarifa mayor que 0/)).toBeInTheDocument();
    expect(configurationApi.update).not.toHaveBeenCalled();
  });

  it("shows the general rate of each tax", async () => {
    render(<SettingsAdmin />);

    expect(
      await screen.findByText("Servicio de restaurante (INC, art. 512-9 ET). Tarifa general: 8 %"),
    ).toBeInTheDocument();
    expect(screen.getByText("Restaurantes bajo franquicia (IVA, arts. 426 y 468 ET). Tarifa general: 19 %")).toBeInTheDocument();
  });

  it("proposes the general rate when a tax is switched on, still off by default", async () => {
    render(<SettingsAdmin />);

    expect(await screen.findByLabelText("Tarifa INC (%)")).toHaveValue("");
    fireEvent.click(screen.getByLabelText("Cobrar INC"));
    expect(screen.getByLabelText("Tarifa INC (%)")).toHaveValue("8");

    fireEvent.click(screen.getByLabelText("Cobrar IVA"));
    expect(screen.getByLabelText("Tarifa IVA (%)")).toHaveValue("19");
  });

  it("keeps a rate the administrator already saved", async () => {
    configurationApi.get.mockResolvedValue({ ...DEFAULT_SETTINGS, inc_rate: "4.00" });
    render(<SettingsAdmin />);

    fireEvent.click(await screen.findByLabelText("Cobrar INC"));

    expect(screen.getByLabelText("Tarifa INC (%)")).toHaveValue("4.00");
  });

  it("keeps the form when the API refuses the change", async () => {
    configurationApi.update.mockRejectedValue(new ApiError("Hay cuentas abiertas.", 400));
    render(<SettingsAdmin />);

    fireEvent.click(await screen.findByLabelText("Anticipado"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));

    await waitFor(() => expect(configurationApi.update).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Guardar configuración" })).not.toHaveClass("loading"),
    );
    expect(screen.getByLabelText("Anticipado")).toBeChecked();
  });
});
