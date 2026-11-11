import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "../../../api/client";
import { customerApi } from "../../../api/customer";
import { CustomerLayout } from "../../../layouts/CustomerLayout";
import { cartStorageKey } from "../../../utils/cart";
import { MENU_FILTERS_KEY } from "../../../hooks/useMenuFilters";
import { ALLERGEN_NOTICE } from "../../../utils/labels";
import { CustomerApp } from "../CustomerApp";

jest.mock("../../../api/customer", () => ({
  customerApi: {
    getTable: jest.fn(),
    getOrders: jest.fn(),
    createOrders: jest.fn(),
    requestBill: jest.fn(),
    getCategories: jest.fn(),
    getProducts: jest.fn(),
    getAllergens: jest.fn(),
    getTags: jest.fn(),
  },
}));

const TOKEN = "3f2b6c1e-0d4a-4f7e-9a1b-2c3d4e5f6a7b";
const OPEN_TABLE = { number: 5, is_open: true, bill_requested: false };
const CATEGORY = { id: 1, title: "Postres", image: "postres.jpg" };
const PRODUCT = { id: 10, title: "Helado", price: "4.50", image: "helado.jpg", category_data: CATEGORY };
const BURGER = {
  id: 11,
  title: "Hamburguesa",
  price: "20.00",
  image: "hamburguesa.jpg",
  category_data: CATEGORY,
  modifier_groups: [
    {
      id: 1,
      name: "Término",
      min_choices: 1,
      max_choices: 1,
      modifiers: [
        { id: 21, name: "Medio", price_delta: "0.00" },
        { id: 22, name: "Bien cocida", price_delta: "0.00" },
      ],
    },
    { id: 2, name: "Extras", min_choices: 0, max_choices: 2, modifiers: [{ id: 30, name: "Queso", price_delta: "3.00" }] },
  ],
};
const PENDING_ORDER = {
  id: 99,
  product: 10,
  product_title: "Helado",
  quantity: 1,
  notes: "",
  price: "4.50",
  status: "PENDING",
};

function renderCustomer(path = `/client/${TOKEN}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/client/:token/*"
          element={
            <CustomerLayout>
              <CustomerApp />
            </CustomerLayout>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const GLUTEN = { id: 1, name: "Gluten" };
const DAIRY = { id: 7, name: "Lácteos" };
const VEGAN = { id: 1, name: "Vegano" };
const BREAD = { ...PRODUCT, id: 20, title: "Pan", allergens: [GLUTEN], allergens_declared: true, tags: [] };
const SALAD = { ...PRODUCT, id: 21, title: "Ensalada", allergens: [], allergens_declared: true, tags: [VEGAN] };
const FLAN = { ...PRODUCT, id: 22, title: "Flan", allergens: [], allergens_declared: false, tags: [] };

describe("customer menu flow", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
    customerApi.getTable.mockResolvedValue(OPEN_TABLE);
    customerApi.getCategories.mockResolvedValue([CATEGORY]);
    customerApi.getProducts.mockResolvedValue([PRODUCT]);
    customerApi.getOrders.mockResolvedValue([]);
    customerApi.getAllergens.mockResolvedValue([GLUTEN, DAIRY]);
    customerApi.getTags.mockResolvedValue([VEGAN]);
  });

  it("explains that an unknown QR is not valid", async () => {
    customerApi.getTable.mockRejectedValue(new ApiError("Este código QR no es válido.", 404));

    renderCustomer();

    expect(await screen.findByText("Código QR no válido")).toBeInTheDocument();
    expect(screen.queryByText("Carta")).not.toBeInTheDocument();
  });

  it("asks the guest to call the waiter while the table is closed", async () => {
    customerApi.getTable.mockResolvedValue({ ...OPEN_TABLE, is_open: false });

    renderCustomer();

    expect(await screen.findByText("La mesa aún no está habilitada")).toBeInTheDocument();
    expect(customerApi.getCategories).not.toHaveBeenCalled();
  });

  it("warns when the API is throttling the table", async () => {
    customerApi.getTable.mockRejectedValue(new ApiError("Demasiadas solicitudes.", 429, null, 5));

    renderCustomer();

    expect(await screen.findByText("Demasiadas solicitudes. Espera unos segundos.")).toBeInTheDocument();
  });

  it("orders a product from the menu and shows it in the orders list", async () => {
    customerApi.createOrders.mockResolvedValue([PENDING_ORDER]);
    renderCustomer();

    fireEvent.click(await screen.findByText("Postres"));
    fireEvent.click(await screen.findByRole("button", { name: /Añadir/ }));
    fireEvent.click(screen.getByRole("link", { name: /Carrito/ }));
    customerApi.getOrders.mockResolvedValue([PENDING_ORDER]);
    fireEvent.click(await screen.findByRole("button", { name: "Enviar pedido" }));

    await waitFor(() =>
      expect(customerApi.createOrders).toHaveBeenCalledWith(TOKEN, [{ product: 10, quantity: 1, notes: "", modifiers: [] }]),
    );
    expect(await screen.findByText("Mis pedidos")).toBeInTheDocument();
    expect(await screen.findByText("Pendiente")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(cartStorageKey(TOKEN)))).toEqual([]);
  });

  it("keeps the cart when sending the order fails", async () => {
    customerApi.createOrders.mockRejectedValue(new ApiError("El producto no está disponible.", 400));
    localStorage.setItem(
      cartStorageKey(TOKEN),
      JSON.stringify([{ productId: 10, title: "Helado", price: "4.50", quantity: 2, notes: "" }]),
    );
    renderCustomer(`/client/${TOKEN}/cart`);

    fireEvent.click(await screen.findByRole("button", { name: "Enviar pedido" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Enviar pedido" })).not.toHaveClass("loading"),
    );
    expect(customerApi.createOrders).toHaveBeenCalled();
    expect(screen.getByText("Tu pedido")).toBeInTheDocument();
    expect(screen.getByText("Helado")).toBeInTheDocument();
  });

  it("asks for the options of a product before adding it and sends them", async () => {
    customerApi.getProducts.mockResolvedValue([BURGER]);
    customerApi.createOrders.mockResolvedValue([]);
    renderCustomer();

    fireEvent.click(await screen.findByText("Postres"));
    fireEvent.click(await screen.findByRole("button", { name: /Añadir/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Añadir — \$20.00/ }));
    expect(await screen.findByText("Elige 1 opción en Término.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Bien cocida"));
    fireEvent.click(screen.getByLabelText("Queso +$3.00"));
    fireEvent.click(screen.getByRole("button", { name: /Añadir — \$23.00/ }));
    fireEvent.click(screen.getByRole("link", { name: /Carrito/ }));

    expect(await screen.findByText("Bien cocida, Queso")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    await waitFor(() =>
      expect(customerApi.createOrders).toHaveBeenCalledWith(TOKEN, [
        { product: 11, quantity: 1, notes: "", modifiers: [22, 30] },
      ]),
    );
  });

  it("lets the guest ask for the bill once", async () => {
    customerApi.getOrders.mockResolvedValue([PENDING_ORDER]);
    customerApi.requestBill.mockResolvedValue({ ...OPEN_TABLE, bill_requested: true });
    renderCustomer(`/client/${TOKEN}/orders`);

    fireEvent.click(await screen.findByRole("button", { name: "Pedir la cuenta" }));

    expect(await screen.findByText("Ya pediste la cuenta. El personal viene en camino.")).toBeInTheDocument();
    expect(customerApi.requestBill).toHaveBeenCalledWith(TOKEN);
    expect(screen.queryByRole("button", { name: "Pedir la cuenta" })).not.toBeInTheDocument();
  });

  it("shows the tags and what each product contains", async () => {
    customerApi.getProducts.mockResolvedValue([BREAD, SALAD, FLAN]);
    renderCustomer();

    fireEvent.click(await screen.findByText("Postres"));

    expect(await screen.findByText("Contiene: gluten")).toBeInTheDocument();
    expect(screen.getByText("Vegano")).toBeInTheDocument();
    expect(screen.getByText("Sin alérgenos declarados")).toBeInTheDocument();
    expect(screen.getByText("Consulta los alérgenos al personal")).toBeInTheDocument();
    expect(screen.getByText(ALLERGEN_NOTICE)).toBeInTheDocument();
  });

  it("hides what contains an allergen and what nobody reviewed, and remembers it", async () => {
    customerApi.getProducts.mockResolvedValue([BREAD, SALAD, FLAN]);
    renderCustomer();

    fireEvent.click(await screen.findByText("Postres"));
    fireEvent.click(await screen.findByRole("button", { name: /Filtros/ }));
    fireEvent.click(await screen.findByRole("option", { name: "Gluten" }));

    await waitFor(() => expect(screen.queryByText("Pan")).not.toBeInTheDocument());
    expect(screen.queryByText("Flan")).not.toBeInTheDocument();
    expect(screen.getByText("Ensalada")).toBeInTheDocument();
    expect(
      screen.getByText("2 producto(s) ocultos por los filtros, 1 por no tener información de alérgenos."),
    ).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(MENU_FILTERS_KEY))).toEqual({ allergenIds: [1], tagIds: [] });
  });

  it("shows only the products with every chosen tag", async () => {
    sessionStorage.setItem(MENU_FILTERS_KEY, JSON.stringify({ allergenIds: [], tagIds: [VEGAN.id] }));
    customerApi.getProducts.mockResolvedValue([BREAD, SALAD, FLAN]);
    renderCustomer();

    fireEvent.click(await screen.findByText("Postres"));

    expect(await screen.findByText("Ensalada")).toBeInTheDocument();
    expect(screen.queryByText("Pan")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtros (1)" })).toBeInTheDocument();
  });

  it("keeps the saved allergen filter when the lists cannot load", async () => {
    sessionStorage.setItem(MENU_FILTERS_KEY, JSON.stringify({ allergenIds: [GLUTEN.id], tagIds: [] }));
    customerApi.getAllergens.mockRejectedValue(new Error("offline"));
    customerApi.getProducts.mockResolvedValue([BREAD, SALAD]);
    renderCustomer();

    fireEvent.click(await screen.findByText("Postres"));

    expect(await screen.findByText("Ensalada")).toBeInTheDocument();
    expect(screen.queryByText("Pan")).not.toBeInTheDocument();
  });
});
