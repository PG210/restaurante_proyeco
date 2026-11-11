import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { modifierGroupApi } from "../../../api/modifierGroup";
import { orderApi } from "../../../api/order";
import { productApi } from "../../../api/product";
import { categoryApi } from "../../../api/category";
import { AddEditModifierGroupForm, AddEditProductForm, AddOrderForm } from "../../../components/Admin";
import { KitchenBoard } from "../../../components/Admin/Order/KitchenBoard/KitchenBoard";
import { NOT_ENOUGH_OPTIONS_MESSAGE } from "../../../components/Admin/Modifier/AddEditModifierGroupForm/AddEditModifierGroupForm";
import { ORDER_STATUS } from "../../../utils/orderStatus";
import { ModifiersAdmin, deleteGroupConfirmation } from "../ModifiersAdmin";

jest.mock("../../../api/modifierGroup", () => ({
  modifierGroupApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
}));
jest.mock("../../../api/product", () => ({
  productApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), setModifierGroups: jest.fn() },
}));
jest.mock("../../../api/category", () => ({
  categoryApi: { list: jest.fn() },
}));
jest.mock("../../../api/order", () => ({
  orderApi: { createBulk: jest.fn() },
}));

const DONENESS = {
  id: 1,
  name: "Término",
  min_choices: 1,
  max_choices: 1,
  active: true,
  position: 0,
  product_count: 2,
  modifiers: [
    { id: 21, name: "Medio", price_delta: "0.00", active: true, position: 0 },
    { id: 22, name: "Bien cocida", price_delta: "0.00", active: true, position: 1 },
  ],
};
const EXTRAS = {
  id: 2,
  name: "Extras",
  min_choices: 0,
  max_choices: 2,
  active: false,
  position: 1,
  product_count: 0,
  modifiers: [{ id: 30, name: "Queso", price_delta: "3.00", active: true, position: 0 }],
};
const CATEGORY = { id: 1, title: "Platos", active: true };
const BURGER = {
  id: 3,
  title: "Hamburguesa",
  description: "",
  price: "20.00",
  image: "burger.jpg",
  active: true,
  is_available: true,
  position: 0,
  category: 1,
  category_data: CATEGORY,
  modifier_group_ids: [1],
  modifier_groups: [DONENESS],
};

describe("ModifiersAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    modifierGroupApi.list.mockResolvedValue([DONENESS, EXTRAS]);
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => window.confirm.mockRestore());

  it("lists the groups with their rule, options and products", async () => {
    render(<ModifiersAdmin />);

    const row = await screen.findByRole("row", { name: /Término/ });
    expect(within(row).getByText("Elige 1")).toBeInTheDocument();
    expect(within(row).getByText("Bien cocida")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Extras/ })).getByText("Queso (+$3.00)")).toBeInTheDocument();
  });

  it("searches groups by option name", async () => {
    render(<ModifiersAdmin />);

    fireEvent.change(await screen.findByLabelText("Buscar grupo u opción"), { target: { value: "queso" } });

    await waitFor(() => expect(screen.queryByText("Término")).not.toBeInTheDocument());
    expect(screen.getByText("Extras")).toBeInTheDocument();
  });

  it("deletes a group after warning how many products use it", async () => {
    modifierGroupApi.remove.mockResolvedValue(null);
    render(<ModifiersAdmin />);

    fireEvent.click(await screen.findByRole("button", { name: "Eliminar Término" }));

    expect(window.confirm).toHaveBeenCalledWith(deleteGroupConfirmation(DONENESS));
    expect(deleteGroupConfirmation(DONENESS)).toContain("Lo usan 2 producto(s)");
    await waitFor(() => expect(modifierGroupApi.remove).toHaveBeenCalledWith(1));
    await waitFor(() => expect(modifierGroupApi.list).toHaveBeenCalledTimes(2));
  });
});

describe("AddEditModifierGroupForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates a group with its options in order", async () => {
    modifierGroupApi.create.mockResolvedValue({ id: 5 });
    const onRefetch = jest.fn();
    render(<AddEditModifierGroupForm onClose={jest.fn()} onRefetch={onRefetch} />);

    fireEvent.change(screen.getByLabelText("Nombre del grupo"), { target: { value: " Tamaño " } });
    fireEvent.click(screen.getByRole("button", { name: /Añadir opción/ }));
    fireEvent.click(screen.getByRole("button", { name: /Añadir opción/ }));
    fireEvent.change(screen.getByLabelText("Nombre de la opción 1"), { target: { value: "Pequeño" } });
    fireEvent.change(screen.getByLabelText("Nombre de la opción 2"), { target: { value: "Grande" } });
    fireEvent.change(screen.getByLabelText("Precio extra de la opción 2"), { target: { value: "4.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(modifierGroupApi.create).toHaveBeenCalled());
    expect(modifierGroupApi.create.mock.calls[0][0]).toEqual({
      name: "Tamaño",
      min_choices: 0,
      max_choices: 1,
      active: true,
      position: 0,
      modifiers: [
        { name: "Pequeño", price_delta: "0", active: true, position: 0 },
        { name: "Grande", price_delta: "4.5", active: true, position: 1 },
      ],
    });
    await waitFor(() => expect(onRefetch).toHaveBeenCalled());
  });

  it("keeps the ids of existing options and drops removed ones", async () => {
    modifierGroupApi.update.mockResolvedValue(DONENESS);
    render(<AddEditModifierGroupForm group={DONENESS} onClose={jest.fn()} onRefetch={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar opción 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(modifierGroupApi.update).toHaveBeenCalled());
    const [id, payload] = modifierGroupApi.update.mock.calls[0];
    expect(id).toBe(1);
    expect(payload.modifiers).toEqual([{ id: 22, name: "Bien cocida", price_delta: "0.00", active: true, position: 0 }]);
  });

  it("rejects a maximum below the minimum and a required group without options", async () => {
    render(<AddEditModifierGroupForm onClose={jest.fn()} onRefetch={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("Nombre del grupo"), { target: { value: "Salsas" } });
    fireEvent.change(screen.getByLabelText("Mínimo a elegir"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(await screen.findByText("El máximo es al menos 1 y no menor que el mínimo")).toBeInTheDocument();
    expect(screen.getByText(NOT_ENOUGH_OPTIONS_MESSAGE)).toBeInTheDocument();
    expect(modifierGroupApi.create).not.toHaveBeenCalled();
  });
});

describe("product form option groups", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    categoryApi.list.mockResolvedValue([CATEGORY]);
    modifierGroupApi.list.mockResolvedValue([DONENESS, EXTRAS]);
    productApi.update.mockResolvedValue(BURGER);
    productApi.setModifierGroups.mockResolvedValue(BURGER);
  });

  it("does not resend the groups when they did not change", async () => {
    render(<AddEditProductForm product={BURGER} onClose={jest.fn()} onRefetch={jest.fn()} />);
    await waitFor(() => expect(modifierGroupApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(productApi.update).toHaveBeenCalled());
    expect(productApi.update.mock.calls[0][1]).not.toHaveProperty("modifierGroupIds");
    expect(productApi.setModifierGroups).not.toHaveBeenCalled();
  });

  it("saves the groups chosen for the product", async () => {
    render(<AddEditProductForm product={BURGER} onClose={jest.fn()} onRefetch={jest.fn()} />);
    await screen.findByText("Término (Elige 1)");

    fireEvent.click(screen.getByRole("option", { name: "Extras (inactivo)" }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(productApi.setModifierGroups).toHaveBeenCalledWith(3, [1, 2]));
  });
});

describe("staff order form with options", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    productApi.list.mockResolvedValue([BURGER]);
    orderApi.createBulk.mockResolvedValue([]);
  });

  it("requires the options of the chosen product and sends them", async () => {
    const onClose = jest.fn();
    render(<AddOrderForm tableId={7} onClose={onClose} onRefetch={jest.fn()} />);
    await waitFor(() => expect(productApi.list).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("option", { name: "Hamburguesa — $20.00" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar a la lista" }));
    expect(await screen.findByText("Elige 1 opción en Término.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Medio"));
    fireEvent.click(screen.getByRole("button", { name: "Agregar a la lista" }));
    expect(await screen.findByText(/Hamburguesa \(Medio\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido (1)" }));

    await waitFor(() =>
      expect(orderApi.createBulk).toHaveBeenCalledWith(7, [{ product: 3, quantity: 1, notes: "", modifiers: [21] }]),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar pedido (1)" })).not.toHaveClass("loading"));
  });
});

describe("kitchen card", () => {
  it("shows the chosen options under the product", () => {
    const order = {
      id: 1,
      status: ORDER_STATUS.PENDING,
      quantity: 1,
      notes: "",
      created_at: "2026-11-10T12:00:00Z",
      product_data: { title: "Hamburguesa" },
      table_data: { number: 4 },
      modifiers: [
        { group_name: "Término", modifier_name: "Bien cocida", price_delta: "0.00" },
        { group_name: "Extras", modifier_name: "Queso", price_delta: "3.00" },
      ],
    };

    render(<KitchenBoard orders={[order]} user={{ is_staff: true, permissions: [] }} now={Date.now()} onAdvance={jest.fn()} />);

    expect(screen.getByText("Bien cocida, Queso")).toBeInTheDocument();
  });
});
