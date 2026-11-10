import { ApiError } from "../../api/client";
import { DEFAULT_RETRY_AFTER_SECONDS } from "../constants";
import { CUSTOMER_ERROR_VIEW, getCustomerErrorView, getRetryDelayMs, isThrottled } from "../customerErrors";

describe("customer errors", () => {
  it.each([
    [404, CUSTOMER_ERROR_VIEW.INVALID_QR],
    [403, CUSTOMER_ERROR_VIEW.TABLE_CLOSED],
    [429, CUSTOMER_ERROR_VIEW.THROTTLED],
    [500, CUSTOMER_ERROR_VIEW.GENERIC],
  ])("maps status %i to the %s view", (status, view) => {
    expect(getCustomerErrorView(new ApiError("x", status))).toBe(view);
  });

  it("treats network errors without status as generic", () => {
    expect(getCustomerErrorView(new TypeError("Failed to fetch"))).toBe(CUSTOMER_ERROR_VIEW.GENERIC);
  });

  it("detects throttled responses", () => {
    expect(isThrottled(new ApiError("x", 429))).toBe(true);
    expect(isThrottled(new ApiError("x", 400))).toBe(false);
  });

  it("waits the seconds sent in Retry-After", () => {
    expect(getRetryDelayMs(new ApiError("x", 429, null, 12))).toBe(12000);
  });

  it("falls back to a default wait when Retry-After is missing", () => {
    expect(getRetryDelayMs(new ApiError("x", 429))).toBe(DEFAULT_RETRY_AFTER_SECONDS * 1000);
  });
});
