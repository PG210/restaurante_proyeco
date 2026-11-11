import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { categoryApi } from "../../../api/category";
import { modifierGroupApi } from "../../../api/modifierGroup";
import { productApi } from "../../../api/product";
import { allergenApi, tagApi } from "../../../api/productLabel";
import { AddEditProductForm, TableProductAdmin } from "../../../components/Admin";
import { PREPARATION_MESSAGE } from "../../../utils/preparation";
import { ProductList } from "../../Customer/CustomerCategory";

jest.mock("../../../api/product", () => ({
  productApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), setLabels: jest.fn() },
}));
jest.mock("../../../api/category", () => ({
  categoryApi: { list: jest.fn() },
}));
jest.mock("../../../api/modifierGroup", () => ({
  modifierGroupApi: { list: jest.fn() },
}));
jest.mock("../../../api/productLabel", () => ({
  allergenApi: { list: jest.fn() },
  tagApi: { list: jest.fn() },
}));

const CATEGORY = { id: 1, title: "Platos", active: true };
const BURGER = {
  id: 5,
  title: "Hamburguesa",
  description: "",
  price: "20.00",
  image: "burger.jpg",
  active: true,
  is_available: true,
  position: 0,
  category: 1,
  category_data: CATEGORY,
  preparation_time: 20,
  modifier_group_ids: [],
  modifier_groups: [],
  allergen_ids: [],
  allergens: [],
  allergens_declared: true,
  tag_ids: [],
  tags: [],
};
const SODA = { ...BURGER, id: 6, title: "Gaseosa", preparation_time: null };
const FIELD = "Tiempo de preparación (min)";

function renderForm(product = BURGER) {
  render(<AddEditProductForm product={product} onClose={jest.fn()} onRefetch={jest.fn()} />);
}

async function submitWith(value) {
  await waitFor(() => expect(categoryApi.list).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText(FIELD), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
}

describe("product preparation time", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    categoryApi.list.mockResolvedValue([CATEGORY]);
    modifierGroupApi.list.mockResolvedValue([]);
    allergenApi.list.mockResolvedValue([]);
    tagApi.list.mockResolvedValue([]);
    productApi.update.mockResolvedValue(BURGER);
  });

  it("loads the current time and saves a new one", async () => {
    renderForm();
    expect(screen.getByLabelText(FIELD)).toHaveValue(20);

    await submitWith("35");

    await waitFor(() => expect(productApi.update).toHaveBeenCalled());
    expect(productApi.update.mock.calls[0][1]).toMatchObject({ preparation_time: 35 });
  });

  it("clears the time when the field is emptied", async () => {
    renderForm();

    await submitWith("");

    await waitFor(() => expect(productApi.update).toHaveBeenCalled());
    expect(productApi.update.mock.calls[0][1]).toMatchObject({ preparation_time: "" });
  });

  it.each(["0", "241", "2.5"])("rejects %s minutes", async (value) => {
    renderForm();

    await submitWith(value);

    expect(await screen.findByText(PREPARATION_MESSAGE)).toBeInTheDocument();
    expect(productApi.update).not.toHaveBeenCalled();
  });

  it("shows the time in the admin table", () => {
    render(
      <TableProductAdmin
        products={[BURGER, SODA]}
        updateProduct={jest.fn()}
        onDeleteProduct={jest.fn()}
        onToggleAvailability={jest.fn()}
      />,
    );

    expect(within(screen.getByRole("row", { name: /Hamburguesa/ })).getByText("20 min")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Gaseosa/ })).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows an approximate time in the menu only when the product has one", () => {
    render(<ProductList products={[BURGER, SODA]} onAdd={jest.fn()} />);

    expect(screen.getAllByText(/≈ \d+ min/)).toHaveLength(1);
    expect(screen.getByText("≈ 20 min")).toBeInTheDocument();
  });
});
