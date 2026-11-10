import { toCents } from "../money";
import { splitIncludedTaxCents, taxLabel } from "../tax";

describe("splitIncludedTaxCents", () => {
  it("splits INC 8 % included in 108.000", () => {
    expect(splitIncludedTaxCents(toCents("108000"), "8")).toEqual({ baseCents: 10000000, taxCents: 800000 });
  });

  it("matches the backend for a 30.000 dish with INC 8 %", () => {
    expect(splitIncludedTaxCents(toCents("30000"), "8")).toEqual({ baseCents: 2777778, taxCents: 222222 });
  });

  it("rounds to the nearest cent like the backend", () => {
    expect(splitIncludedTaxCents(toCents("10.00"), "19")).toEqual({ baseCents: 840, taxCents: 160 });
  });

  it("leaves the whole amount as base without a rate", () => {
    expect(splitIncludedTaxCents(toCents("30000"), "")).toEqual({ baseCents: 3000000, taxCents: 0 });
  });

  it("always adds back up to the total", () => {
    const { baseCents, taxCents } = splitIncludedTaxCents(1234567, "8");
    expect(baseCents + taxCents).toBe(1234567);
  });
});

describe("taxLabel", () => {
  it("names the tax and its rate", () => {
    expect(taxLabel("INC", "8.00")).toBe("INC 8 %");
  });

  it("is empty when the bill has no tax", () => {
    expect(taxLabel("", null)).toBe("");
  });
});
