import { readJson, writeJson } from "../storage";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("round-trips a value", () => {
    writeJson("key", [{ id: 1 }]);

    expect(readJson("key", [])).toEqual([{ id: 1 }]);
  });

  it("returns the fallback when nothing is stored", () => {
    expect(readJson("missing", [])).toEqual([]);
  });

  it("returns the fallback when the stored value is corrupted", () => {
    localStorage.setItem("key", "{not json");

    expect(readJson("key", [])).toEqual([]);
  });

  it("returns the fallback when storage is blocked", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(readJson("key", [])).toEqual([]);
  });

  it("reports a failed write instead of throwing", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(writeJson("key", [])).toBe(false);
  });
});
