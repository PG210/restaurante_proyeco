import {
  choicesHint,
  hasModifiers,
  isSelectionValid,
  modifierSummary,
  selectedModifiers,
  selectionErrors,
  titleWithModifiers,
  toggleModifier,
  unitPrice,
} from "../modifiers";

const DONENESS = {
  id: 1,
  name: "Término",
  min_choices: 1,
  max_choices: 1,
  modifiers: [
    { id: 21, name: "Medio", price_delta: "0.00" },
    { id: 22, name: "Bien cocida", price_delta: "0.00" },
  ],
};
const EXTRAS = {
  id: 2,
  name: "Extras",
  min_choices: 0,
  max_choices: 2,
  modifiers: [
    { id: 30, name: "Queso", price_delta: "3.00" },
    { id: 31, name: "Tocineta", price_delta: "4.50" },
    { id: 32, name: "Huevo", price_delta: "2.00" },
  ],
};
const GROUPS = [DONENESS, EXTRAS];
const BURGER = { id: 3, title: "Hamburguesa", price: "20.00", modifier_groups: GROUPS };

describe("modifiers", () => {
  it("knows which products have options", () => {
    expect(hasModifiers(BURGER)).toBe(true);
    expect(hasModifiers({ id: 4, modifier_groups: [] })).toBe(false);
    expect(hasModifiers({ id: 5 })).toBe(false);
  });

  it("describes each rule", () => {
    expect(choicesHint(DONENESS)).toBe("Elige 1");
    expect(choicesHint(EXTRAS)).toBe("Opcional, hasta 2");
    expect(choicesHint({ min_choices: 0, max_choices: 1 })).toBe("Opcional");
    expect(choicesHint({ min_choices: 1, max_choices: 3 })).toBe("Elige de 1 a 3");
  });

  it("replaces the choice in a single choice group", () => {
    expect(toggleModifier(DONENESS, [21, 30], 22)).toEqual([30, 22]);
  });

  it("does not go over the maximum and unselects on a second click", () => {
    const twoExtras = [30, 31];

    expect(toggleModifier(EXTRAS, twoExtras, 32)).toBe(twoExtras);
    expect(toggleModifier(EXTRAS, twoExtras, 30)).toEqual([31]);
  });

  it("reports the groups that break their rule with the API message", () => {
    expect(selectionErrors(GROUPS, [30])).toEqual({ 1: "Elige 1 opción en Término." });
    expect(isSelectionValid(GROUPS, [21, 30])).toBe(true);
  });

  it("adds the options to the unit price in group order", () => {
    const modifiers = selectedModifiers(GROUPS, [31, 22]);

    expect(modifiers.map((modifier) => modifier.name)).toEqual(["Bien cocida", "Tocineta"]);
    expect(unitPrice(BURGER, modifiers)).toBe(24.5);
  });

  it("summarises copied order options and cart options", () => {
    const copied = [{ group_name: "Término", modifier_name: "Medio", price_delta: "0.00" }];

    expect(modifierSummary(copied)).toBe("Medio");
    expect(modifierSummary(undefined)).toBe("");
    expect(titleWithModifiers("Hamburguesa", [{ name: "Medio" }, { name: "Queso" }])).toBe("Hamburguesa (Medio, Queso)");
    expect(titleWithModifiers("Jugo", [])).toBe("Jugo");
  });
});
