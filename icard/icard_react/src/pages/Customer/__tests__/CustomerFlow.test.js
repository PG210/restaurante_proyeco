import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "../../../api/client";
import { customerApi } from "../../../api/customer";
import { CustomerLayout } from "../../../layouts/CustomerLayout";
import { cartStorageKey } from "../../../utils/cart";
import { CustomerApp } from "../CustomerApp";

jest.mock("../../../api/customer", () => ({
  customerApi: {
    getTable: jest.fn(),
    getOrders: jest.fn(),
    createOrders: jest.fn(),
    requestBill: jest.fn(),
    getCategories: jest.fn(),
    getProducts: jest.fn(),
  },
}));

const TOKEN = "3f2b6c1e-0d4a-4f7e-9a1b-2c3d4e5f6a7b";
const OPEN_TABLE = { number: 5, is_open: true, bill_requested: false };
const CATEGORY = { id: 1, title: "Postres", image: "postres.jpg" };
const PRODUCT = { id: 10, title: "Helado", price: "4.50", image: "helado.jpg", category_data: CATEGORY };
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

describe("customer menu flow", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    customerApi.getTable.mockResolvedValue(OPEN_TABLE);
    customerApi.getCategories.mockResolvedValue([CATEGORY]);
    customerApi.getProducts.mockResolvedValue([PRODUCT]);
    customerApi.getOrders.mockResolvedValue([]);
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
      expect(customerApi.createOrders).toHaveBeenCalledWith(TOKEN, [{ product: 10, quantity: 1, notes: "" }]),
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

  it("lets the guest ask for the bill once", async () => {
    customerApi.getOrders.mockResolvedValue([PENDING_ORDER]);
    customerApi.requestBill.mockResolvedValue({ ...OPEN_TABLE, bill_requested: true });
    renderCustomer(`/client/${TOKEN}/orders`);

    fireEvent.click(await screen.findByRole("button", { name: "Pedir la cuenta" }));

    expect(await screen.findByText("Ya pediste la cuenta. El personal viene en camino.")).toBeInTheDocument();
    expect(customerApi.requestBill).toHaveBeenCalledWith(TOKEN);
    expect(screen.queryByRole("button", { name: "Pedir la cuenta" })).not.toBeInTheDocument();
  });
});
