import { act, renderHook } from "@testing-library/react";
import { usePolling } from "../usePolling";

const INTERVAL_MS = 1000;

describe("usePolling", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls the callback on every interval while enabled", () => {
    const callback = jest.fn();
    renderHook(() => usePolling(callback, INTERVAL_MS, true));

    act(() => {
      jest.advanceTimersByTime(INTERVAL_MS * 3);
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("does not call the callback while disabled", () => {
    const callback = jest.fn();
    renderHook(() => usePolling(callback, INTERVAL_MS, false));

    act(() => {
      jest.advanceTimersByTime(INTERVAL_MS * 3);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("stops when it is disabled", () => {
    const callback = jest.fn();
    const { rerender } = renderHook(({ enabled }) => usePolling(callback, INTERVAL_MS, enabled), {
      initialProps: { enabled: true },
    });

    act(() => {
      jest.advanceTimersByTime(INTERVAL_MS);
    });
    rerender({ enabled: false });
    act(() => {
      jest.advanceTimersByTime(INTERVAL_MS * 3);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("stops when the component unmounts", () => {
    const callback = jest.fn();
    const { unmount } = renderHook(() => usePolling(callback, INTERVAL_MS, true));

    unmount();
    act(() => {
      jest.advanceTimersByTime(INTERVAL_MS * 3);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("uses the latest callback without restarting the interval", () => {
    const firstCallback = jest.fn();
    const latestCallback = jest.fn();
    const { rerender } = renderHook(({ callback }) => usePolling(callback, INTERVAL_MS, true), {
      initialProps: { callback: firstCallback },
    });

    rerender({ callback: latestCallback });
    act(() => {
      jest.advanceTimersByTime(INTERVAL_MS);
    });

    expect(firstCallback).not.toHaveBeenCalled();
    expect(latestCallback).toHaveBeenCalledTimes(1);
  });
});
