import { buildCustomerUrl, customerPath } from "../customerPaths";

const TOKEN = "3f2b6c1e-0d4a-4f7e-9a1b-2c3d4e5f6a7b";

describe("customer paths", () => {
  it("builds the menu path from the table token", () => {
    expect(customerPath(TOKEN)).toBe(`/client/${TOKEN}`);
  });

  it("builds a category path", () => {
    expect(customerPath(TOKEN, "category", { categoryId: 7 })).toBe(`/client/${TOKEN}/category/7`);
  });

  it("builds the cart and orders paths", () => {
    expect(customerPath(TOKEN, "cart")).toBe(`/client/${TOKEN}/cart`);
    expect(customerPath(TOKEN, "orders")).toBe(`/client/${TOKEN}/orders`);
  });

  it("builds the QR url with the public base url", () => {
    expect(buildCustomerUrl(TOKEN, "https://carta.example.com")).toBe(`https://carta.example.com/client/${TOKEN}`);
  });

  it("does not duplicate slashes when the base url ends with one", () => {
    expect(buildCustomerUrl(TOKEN, "https://carta.example.com/")).toBe(`https://carta.example.com/client/${TOKEN}`);
  });

  it("never puts the table number in the url", () => {
    expect(buildCustomerUrl(TOKEN, "https://carta.example.com")).not.toMatch(/\/client\/\d+$/);
  });
});
