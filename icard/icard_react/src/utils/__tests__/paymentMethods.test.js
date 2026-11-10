import { PAYMENT_METHOD, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS, needsReference } from "../paymentMethods";

const BACKEND_PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER"];

describe("payment methods", () => {
  it.each(BACKEND_PAYMENT_METHODS)("has a label for the backend method %s", (method) => {
    expect(PAYMENT_METHOD_LABELS[method]).toEqual(expect.any(String));
  });

  it("offers exactly the methods the backend accepts", () => {
    expect(PAYMENT_METHOD_OPTIONS.map((option) => option.value).sort()).toEqual([...BACKEND_PAYMENT_METHODS].sort());
  });

  it("asks for a reference for card and transfer payments", () => {
    expect(needsReference(PAYMENT_METHOD.CARD)).toBe(true);
    expect(needsReference(PAYMENT_METHOD.TRANSFER)).toBe(true);
  });

  it("does not ask for a reference for cash", () => {
    expect(needsReference(PAYMENT_METHOD.CASH)).toBe(false);
  });
});
