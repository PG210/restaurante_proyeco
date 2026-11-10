import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { productApi } from "../../../api/product";
import { AuthContext } from "../../../context/AuthContext";
import { categoryApi } from "../../../api/category";
import { AddEditCategoryForm, AddEditProductForm } from "../../../components/Admin";
import { toProductOptions } from "../../../components/Admin/Order/AddOrderForm/AddOrderForm";
import { ProductList } from "../../Customer/CustomerCategory";
import { AvailabilityAdmin, RESTOCK_CONFIRMATION, restockMessage } from "../AvailabilityAdmin";
import { ProductAdmin } from "../ProductAdmin";

jest.mock("../../../api/product", () => ({
  productApi: {
    list: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    setAvailability: jest.fn(),
    restock: jest.fn(),
    addStock: jest.fn(),
    setStock: jest.fn(),
    stockMovements: jest.fn(),
  },
}));
jest.mock("../../../api/category", () => ({
  categoryApi: { list: jest.fn(), update: jest.fn(), create: jest.fn() },
}));

const DESSERTS = { id: 1, title: "Postres", image: "postres.jpg", active: true, position: 0 };
const ICE_CREAM = {
  id: 10,
  title: "Helado",
  description: "Tres sabores",
  price: "4.50",
  image: "helado.jpg",
  active: true,
  is_available: true,
  sold_out_today: false,
  position: 0,
  category: 1,
  category_data: DESSERTS,
};
const FLAN = { ...ICE_CREAM, id: 11, title: "Flan", description: "", is_available: false, sold_out_today: true };
const KITCHEN = { is_staff: false, permissions: ["view_order", "set_product_availability", "manage_stock"] };

function renderAvailability(user = KITCHEN) {
  return render(
    <AuthContext.Provider value={{ auth: { me: user } }}>
      <AvailabilityAdmin />
    </AuthContext.Provider>,
  );
}

function rowTitles() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[1].textContent);
}

describe("ProductAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    productApi.list.mockResolvedValue([ICE_CREAM, FLAN]);
  });

  it("searches products by name ignoring accents", async () => {
    render(<ProductAdmin />);

    fireEvent.change(await screen.findByLabelText("Buscar producto"), { target: { value: "HELADO" } });

    expect(await screen.findByText("Mostrando 1 de 2")).toBeInTheDocument();
    expect(rowTitles()).toEqual(["Helado"]);
  });

  it("filters the products sold out today", async () => {
    render(<ProductAdmin />);
    await screen.findByText("Mostrando 2 de 2");

    fireEvent.click(screen.getByText("Agotados"));

    expect(await screen.findByText("Mostrando 1 de 2")).toBeInTheDocument();
    expect(rowTitles()).toEqual(["Flan"]);
  });

  it("offers to clear the filters when nothing matches", async () => {
    render(<ProductAdmin />);

    fireEvent.change(await screen.findByLabelText("Buscar producto"), { target: { value: "pizza" } });
    fireEvent.click(await screen.findByRole("button", { name: "Limpiar filtros" }));

    expect(await screen.findByText("Mostrando 2 de 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar producto")).toHaveValue("");
  });

  it("marks a product sold out from the table without reloading", async () => {
    productApi.setAvailability.mockResolvedValue({ ...ICE_CREAM, is_available: false, sold_out_today: true });
    render(<ProductAdmin />);

    fireEvent.click(await screen.findByLabelText("Disponible hoy: Helado"));

    await waitFor(() => expect(productApi.setAvailability).toHaveBeenCalledWith(10, false));
    await waitFor(() => expect(screen.getByLabelText("Disponible hoy: Helado")).not.toBeChecked());
    expect(productApi.list).toHaveBeenCalledTimes(1);
  });
});

describe("AvailabilityAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    productApi.list.mockResolvedValue([ICE_CREAM, FLAN]);
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => window.confirm.mockRestore());

  it("lists only active products and marks one sold out", async () => {
    productApi.setAvailability.mockResolvedValue({ ...ICE_CREAM, is_available: false, sold_out_today: true });
    renderAvailability();

    fireEvent.click(await screen.findByLabelText("Agotado hoy: Helado"));

    expect(productApi.list).toHaveBeenCalledWith({ active: true });
    await waitFor(() => expect(productApi.setAvailability).toHaveBeenCalledWith(10, false));
    await waitFor(() => expect(screen.getByLabelText("Agotado hoy: Helado")).toBeChecked());
  });

  it("puts a sold out product back", async () => {
    productApi.setAvailability.mockResolvedValue({ ...FLAN, is_available: true, sold_out_today: false });
    renderAvailability();

    fireEvent.click(await screen.findByLabelText("Agotado hoy: Flan"));

    await waitFor(() => expect(productApi.setAvailability).toHaveBeenCalledWith(11, true));
    await waitFor(() => expect(screen.getByLabelText("Agotado hoy: Flan")).not.toBeChecked());
  });

  it("restocks everything after confirming and reloads the list", async () => {
    productApi.restock.mockResolvedValue({ restocked: 1 });
    renderAvailability();
    await screen.findByLabelText("Agotado hoy: Flan");

    fireEvent.click(screen.getByRole("button", { name: /Quitar todos/ }));

    expect(window.confirm).toHaveBeenCalledWith(RESTOCK_CONFIRMATION);
    await waitFor(() => expect(productApi.restock).toHaveBeenCalled());
    await waitFor(() => expect(productApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: /Quitar todos/ })).not.toHaveClass("loading"));
  });

  it("does nothing when the restock is not confirmed", async () => {
    window.confirm.mockReturnValue(false);
    renderAvailability();
    await screen.findByLabelText("Agotado hoy: Flan");

    fireEvent.click(screen.getByRole("button", { name: /Quitar todos/ }));

    expect(productApi.restock).not.toHaveBeenCalled();
  });

  it("describes how many products were restocked", () => {
    expect(restockMessage(0)).toBe("No había productos agotados.");
    expect(restockMessage(1)).toBe("1 producto vuelve a estar disponible.");
    expect(restockMessage(3)).toBe("3 productos vuelven a estar disponibles.");
  });
});

describe("catalog forms", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    categoryApi.list.mockResolvedValue([DESSERTS]);
    productApi.update.mockResolvedValue(ICE_CREAM);
    categoryApi.update.mockResolvedValue(DESSERTS);
  });

  it("saves the description and position of a product", async () => {
    render(<AddEditProductForm product={ICE_CREAM} onClose={jest.fn()} onRefetch={jest.fn()} />);
    await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Orden en la carta"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(productApi.update).toHaveBeenCalled());
    const [, payload] = productApi.update.mock.calls[0];
    expect(payload).toMatchObject({ description: "", position: 2 });
  });

  it("hides a category from the menu", async () => {
    render(<AddEditCategoryForm category={DESSERTS} onClose={jest.fn()} onRefetch={jest.fn()} />);

    fireEvent.click(screen.getByLabelText("Visible en la carta"));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(categoryApi.update).toHaveBeenCalled());
    expect(categoryApi.update.mock.calls[0][1]).toMatchObject({ active: false, position: 0 });
  });

  it("rejects a negative position", async () => {
    render(<AddEditCategoryForm category={DESSERTS} onClose={jest.fn()} onRefetch={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("Orden en la carta"), { target: { value: "-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    expect(await screen.findByText("El orden es un número entero desde 0")).toBeInTheDocument();
    expect(categoryApi.update).not.toHaveBeenCalled();
  });
});

describe("menu and order form", () => {
  it("shows the description and a sold out label without the add button", () => {
    render(<ProductList products={[ICE_CREAM, FLAN]} onAdd={jest.fn()} />);

    expect(screen.getByText("Tres sabores")).toBeInTheDocument();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Añadir/ })).toHaveLength(1);
  });

  it("disables sold out products and products of hidden categories when staff add an order", () => {
    const hidden = { ...ICE_CREAM, id: 12, title: "Huevos", category_data: { ...DESSERTS, active: false } };
    const options = toProductOptions([ICE_CREAM, FLAN, hidden]);

    expect(options.map(({ text, disabled }) => [text, disabled])).toEqual([
      ["Helado — $4.50", false],
      ["Flan — $4.50 (agotado hoy)", true],
      ["Huevos — $4.50 (categoría oculta)", true],
    ]);
  });
});
