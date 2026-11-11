import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { categoryApi } from "../../../api/category";
import { modifierGroupApi } from "../../../api/modifierGroup";
import { productApi } from "../../../api/product";
import { allergenApi, tagApi } from "../../../api/productLabel";
import { AddEditProductForm, TableProductAdmin } from "../../../components/Admin";
import {
  labelsPayload,
  productLabelInitialValues,
} from "../../../components/Admin/Product/AddEditProductForm/ProductLabelsField";
import { UNREVIEWED_CELL } from "../../../components/Admin/Product/TableProductAdmin/TableProductAdmin";
import { LabelsAdmin, deleteLabelConfirmation } from "../LabelsAdmin";
import { ProductAdmin } from "../ProductAdmin";

jest.mock("../../../api/productLabel", () => ({
  allergenApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
  tagApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
}));
jest.mock("../../../api/product", () => ({
  productApi: { list: jest.fn(), create: jest.fn(), update: jest.fn(), setLabels: jest.fn() },
}));
jest.mock("../../../api/category", () => ({
  categoryApi: { list: jest.fn() },
}));
jest.mock("../../../api/modifierGroup", () => ({
  modifierGroupApi: { list: jest.fn() },
}));

const GLUTEN = { id: 1, name: "Gluten", active: true, position: 0, product_count: 3 };
const DAIRY = { id: 7, name: "Lácteos", active: true, position: 6, product_count: 0 };
const LUPIN = { id: 13, name: "Altramuces", active: false, position: 12, product_count: 0 };
const VEGAN = { id: 1, name: "Vegano", active: true, position: 0, product_count: 1 };
const CATEGORY = { id: 1, title: "Platos", active: true };
const SALAD = {
  id: 5,
  title: "Ensalada",
  description: "",
  price: "12.00",
  image: "salad.jpg",
  active: true,
  is_available: true,
  position: 0,
  category: 1,
  category_data: CATEGORY,
  modifier_group_ids: [],
  modifier_groups: [],
  allergen_ids: [],
  allergens: [],
  allergens_declared: false,
  tag_ids: [],
  tags: [],
};

function renderLabels() {
  return render(
    <MemoryRouter initialEntries={["/admin/labels"]}>
      <Routes>
        <Route path="/admin/labels" element={<LabelsAdmin />} />
        <Route path="/admin/products" element={<ProductAdmin />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockLists() {
  allergenApi.list.mockResolvedValue([GLUTEN, DAIRY, LUPIN]);
  tagApi.list.mockResolvedValue([VEGAN]);
  categoryApi.list.mockResolvedValue([CATEGORY]);
  modifierGroupApi.list.mockResolvedValue([]);
  productApi.list.mockResolvedValue([SALAD]);
}

describe("LabelsAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLists();
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => window.confirm.mockRestore());

  it("lists allergens and tags with how many products use them", async () => {
    renderLabels();

    const allergens = await screen.findByRole("table", { name: "Alérgenos" });
    const gluten = within(allergens).getByRole("row", { name: /Gluten/ });
    expect(within(gluten).getByText("3")).toBeInTheDocument();
    expect(within(within(allergens).getByRole("row", { name: /Altramuces/ })).getByText("Inactivo")).toBeInTheDocument();
    expect(within(await screen.findByRole("table", { name: "Etiquetas" })).getByText("Vegano")).toBeInTheDocument();
  });

  it("creates a tag with a trimmed name", async () => {
    tagApi.create.mockResolvedValue({ id: 9 });
    renderLabels();

    fireEvent.click(await screen.findByRole("button", { name: /Nueva etiqueta/ }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "  De temporada " } });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(tagApi.create).toHaveBeenCalledWith({ name: "De temporada", active: true, position: 0 }));
    await waitFor(() => expect(tagApi.list).toHaveBeenCalledTimes(2));
  });

  it("deactivates an allergen", async () => {
    allergenApi.update.mockResolvedValue({ ...DAIRY, active: false });
    renderLabels();

    fireEvent.click(await screen.findByRole("button", { name: "Editar Lácteos" }));
    fireEvent.click(screen.getByLabelText(/^Activo/));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() =>
      expect(allergenApi.update).toHaveBeenCalledWith(7, { name: "Lácteos", active: false, position: 6 }),
    );
  });

  it("deletes after warning how many products use it", async () => {
    allergenApi.remove.mockResolvedValue(null);
    renderLabels();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar Gluten" }));
    allergenApi.list.mockResolvedValue([DAIRY, LUPIN]);

    expect(window.confirm).toHaveBeenCalledWith(deleteLabelConfirmation("allergens", GLUTEN));
    expect(deleteLabelConfirmation("allergens", GLUTEN)).toContain("Lo usan 3 producto(s)");
    await waitFor(() => expect(allergenApi.remove).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByRole("row", { name: /Gluten/ })).not.toBeInTheDocument());
  });

  it("is reached from Products and goes back to it", async () => {
    renderLabels();

    fireEvent.click(await screen.findByRole("button", { name: "Volver a productos" }));
    fireEvent.click(await screen.findByRole("button", { name: "Alérgenos y etiquetas" }));

    expect(await screen.findByRole("table", { name: "Alérgenos" })).toBeInTheDocument();
  });
});

describe("product allergens and tags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLists();
    productApi.update.mockResolvedValue(SALAD);
    productApi.setLabels.mockResolvedValue(SALAD);
  });

  it("sends only what changed and reviews the allergens when they are saved", () => {
    const values = productLabelInitialValues(SALAD);

    expect(labelsPayload(values, SALAD)).toBeNull();
    expect(labelsPayload({ ...values, tagIds: [1] }, SALAD)).toEqual({ tag_ids: [1] });
    expect(labelsPayload({ ...values, allergenIds: [1] }, SALAD)).toEqual({
      allergen_ids: [1],
      allergens_declared: true,
    });
    expect(labelsPayload({ ...values, allergensDeclared: true }, SALAD)).toEqual({
      allergen_ids: [],
      allergens_declared: true,
    });
  });

  it("marks a product without allergens as reviewed", async () => {
    render(<AddEditProductForm product={SALAD} onClose={jest.fn()} onRefetch={jest.fn()} />);
    await waitFor(() => expect(allergenApi.list).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText("Alérgenos revisados"));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() =>
      expect(productApi.setLabels).toHaveBeenCalledWith(5, { allergen_ids: [], allergens_declared: true }),
    );
  });

  it("offers only active allergens and saves the chosen ones", async () => {
    render(<AddEditProductForm product={SALAD} onClose={jest.fn()} onRefetch={jest.fn()} />);

    fireEvent.click(await screen.findByRole("option", { name: "Lácteos" }));
    expect(screen.queryByRole("option", { name: "Altramuces" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Alérgenos revisados")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() =>
      expect(productApi.setLabels).toHaveBeenCalledWith(5, { allergen_ids: [7], allergens_declared: true }),
    );
  });

  it("shows the allergens of each product in the admin table", () => {
    const bread = { ...SALAD, id: 6, title: "Pan", allergens: [GLUTEN], allergens_declared: true };
    const soup = { ...SALAD, id: 7, title: "Sopa", allergens_declared: true };

    render(
      <TableProductAdmin
        products={[SALAD, bread, soup]}
        updateProduct={jest.fn()}
        onDeleteProduct={jest.fn()}
        onToggleAvailability={jest.fn()}
      />,
    );

    expect(within(screen.getByRole("row", { name: /Ensalada/ })).getByText(UNREVIEWED_CELL)).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Pan/ })).getByText("Gluten")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Sopa/ })).getByText("Ninguno")).toBeInTheDocument();
  });
});
