import { act, renderHook } from "@testing-library/react";
import { ApiError } from "../../api/client";
import { useThrottlePause } from "../useThrottlePause";

describe("useThrottlePause", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-09T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("is not paused initially", () => {
    const { result } = renderHook(() => useThrottlePause());

    expect(result.current.isPaused()).toBe(false);
  });

  it("pauses for the Retry-After time after a 429", () => {
    const { result } = renderHook(() => useThrottlePause());

    act(() => result.current.pauseOnThrottle(new ApiError("x", 429, null, 5)));

    expect(result.current.isPaused()).toBe(true);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.isPaused()).toBe(false);
  });

  it("does not pause on other errors", () => {
    const { result } = renderHook(() => useThrottlePause());

    act(() => result.current.pauseOnThrottle(new ApiError("x", 500)));

    expect(result.current.isPaused()).toBe(false);
  });
});
