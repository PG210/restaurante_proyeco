import {
  NO_CATEGORY,
  PRODUCT_FILTERS,
  TABLE_FILTERS,
  USER_FILTERS,
  productCategoryOptions,
} from "../catalogFilters";
import { ALL_VALUES, applyFilters, matchesSearch, normalizeText } from "../tableFilters";

const DESSERTS = { id: 1, title: "Postres", active: true };
const PRODUCTS = [
  { id: 1, title: "Café helado", description: "", category: 1, category_data: DESSERTS, active: true, is_available: true },
  { id: 2, title: "Flan", description: "Con caramelo", category: 1, category_data: DESSERTS, active: false, is_available: true },
  { id: 3, title: "Agua", description: "", category: null, category_data: null, active: true, is_available: false },
];

function filterProducts(search, filters = {}) {
  return applyFilters(PRODUCTS, { ...PRODUCT_FILTERS, search, filters }).map((product) => product.id);
}

describe("text search", () => {
  it("ignores accents, case and surrounding spaces", () => {
    expect(normalizeText("  CAFÉ ")).toBe("cafe");
    expect(matchesSearch({ title: "Café" }, ["title"], "cafe")).toBe(true);
  });

  it("matches every item when the search is empty", () => {
    expect(filterProducts("")).toEqual([1, 2, 3]);
  });

  it("searches the name and the description", () => {
    expect(filterProducts("caramelo")).toEqual([2]);
    expect(filterProducts("helado")).toEqual([1]);
  });

  it("searches numbers such as the table number", () => {
    const tables = [{ number: 12 }, { number: 3 }];

    expect(applyFilters(tables, { ...TABLE_FILTERS, search: "12" })).toEqual([{ number: 12 }]);
  });
});

describe("product filters", () => {
  it("combines the search with the filters", () => {
    expect(filterProducts("a", { active: "true" })).toEqual([1, 3]);
    expect(filterProducts("", { available: "false" })).toEqual([3]);
    expect(filterProducts("", { category: NO_CATEGORY })).toEqual([3]);
    expect(filterProducts("", { category: "1", active: "false" })).toEqual([2]);
  });

  it("ignores filters set to every value", () => {
    expect(filterProducts("", { active: ALL_VALUES, available: ALL_VALUES })).toEqual([1, 2, 3]);
  });

  it("returns an empty list when the items are not loaded yet", () => {
    expect(applyFilters(null, { ...PRODUCT_FILTERS, search: "x" })).toEqual([]);
  });

  it("offers each category once, plus products without one", () => {
    expect(productCategoryOptions(PRODUCTS)).toEqual([
      { key: "1", text: "Postres", value: "1" },
      { key: NO_CATEGORY, text: "Sin categoría", value: NO_CATEGORY },
    ]);
  });
});

describe("user filters", () => {
  const USERS = [
    { id: 1, username: "ana", email: "ana@example.com", first_name: "Ana", last_name: "Pérez", roles: ["cocina"], is_active: true, is_staff: false },
    { id: 2, username: "luis", email: "luis@example.com", first_name: "Luis", last_name: "Gómez", roles: [], is_active: false, is_staff: true },
  ];

  it("searches by last name without accents and filters by role", () => {
    expect(applyFilters(USERS, { ...USER_FILTERS, search: "gomez" }).map((user) => user.id)).toEqual([2]);
    expect(applyFilters(USERS, { ...USER_FILTERS, filters: { role: "cocina" } }).map((user) => user.id)).toEqual([1]);
    expect(applyFilters(USERS, { ...USER_FILTERS, filters: { staff: "true" } }).map((user) => user.id)).toEqual([2]);
  });
});
