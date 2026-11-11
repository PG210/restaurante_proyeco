import {
  EMPTY_MENU_FILTERS,
  NO_ALLERGENS_TEXT,
  UNREVIEWED_TEXT,
  allergenSummary,
  filterMenu,
  hiddenMessage,
  joinNames,
  knownFilters,
} from "../labels";

const GLUTEN = { id: 1, name: "Gluten" };
const EGG = { id: 3, name: "Huevo" };
const VEGAN = { id: 1, name: "Vegano" };
const SPICY = { id: 4, name: "Picante" };
const BREAD = { id: 20, allergens: [GLUTEN, EGG], allergens_declared: true, tags: [] };
const SALAD = { id: 21, allergens: [], allergens_declared: true, tags: [VEGAN, SPICY] };
const SOUP = { id: 22, allergens: [], allergens_declared: true, tags: [VEGAN] };
const FLAN = { id: 23, allergens: [], allergens_declared: false, tags: [VEGAN] };
const MENU = [BREAD, SALAD, SOUP, FLAN];

const ids = (result) => result.products.map((product) => product.id);

describe("labels", () => {
  it("joins names the way they are read", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["gluten"])).toBe("gluten");
    expect(joinNames(["gluten", "huevo", "soja"])).toBe("gluten, huevo y soja");
  });

  it("tells a product without allergens apart from one nobody reviewed", () => {
    expect(allergenSummary(BREAD)).toBe("Contiene: gluten y huevo");
    expect(allergenSummary(SALAD)).toBe(NO_ALLERGENS_TEXT);
    expect(allergenSummary(FLAN)).toBe(UNREVIEWED_TEXT);
    expect(allergenSummary({})).toBe(UNREVIEWED_TEXT);
  });

  it("shows everything without filters", () => {
    expect(filterMenu(MENU, EMPTY_MENU_FILTERS)).toEqual({ products: MENU, hidden: 0, unreviewed: 0 });
  });

  it("hides what contains the allergen and what nobody reviewed", () => {
    const result = filterMenu(MENU, { allergenIds: [GLUTEN.id], tagIds: [] });

    expect(ids(result)).toEqual([SALAD.id, SOUP.id]);
    expect(result).toMatchObject({ hidden: 2, unreviewed: 1 });
    expect(hiddenMessage(result)).toBe("2 producto(s) ocultos por los filtros, 1 por no tener información de alérgenos.");
  });

  it("needs every chosen tag and does not hide unreviewed products for a tag", () => {
    expect(ids(filterMenu(MENU, { allergenIds: [], tagIds: [VEGAN.id] }))).toEqual([SALAD.id, SOUP.id, FLAN.id]);
    expect(ids(filterMenu(MENU, { allergenIds: [], tagIds: [VEGAN.id, SPICY.id] }))).toEqual([SALAD.id]);
    expect(hiddenMessage({ hidden: 1, unreviewed: 0 })).toBe("1 producto(s) ocultos por los filtros.");
    expect(hiddenMessage({ hidden: 0, unreviewed: 0 })).toBe("");
  });

  it("drops saved filters whose label no longer exists", () => {
    const saved = { allergenIds: [GLUTEN.id, 99], tagIds: [SPICY.id] };

    expect(knownFilters(saved, [GLUTEN], [VEGAN])).toEqual({ allergenIds: [GLUTEN.id], tagIds: [] });
    expect(knownFilters(undefined, [GLUTEN], [VEGAN])).toEqual(EMPTY_MENU_FILTERS);
  });
});
