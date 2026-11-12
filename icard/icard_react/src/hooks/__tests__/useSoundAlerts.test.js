import React from "react";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MIN_SOUND_GAP_MS, SOUND_STORAGE_KEY, SoundProvider, useSound } from "../../context/SoundContext";
import { CHIME, playChime } from "../../utils/sound";
import { titleWithCount, useSoundAlerts, useTitleCount } from "../useSoundAlerts";

jest.mock("../../utils/sound", () => ({
  ...jest.requireActual("../../utils/sound"),
  playChime: jest.fn(() => true),
}));

function wrapperWithSound(enabled) {
  window.localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(enabled));
  return ({ children }) => <SoundProvider>{children}</SoundProvider>;
}

function renderAlerts(initialKeys, { enabled = true } = {}) {
  return renderHook(({ keys }) => useSoundAlerts(keys, CHIME.KITCHEN), {
    initialProps: { keys: initialKeys },
    wrapper: wrapperWithSound(enabled),
  });
}

describe("useSoundAlerts", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-12T20:00:00Z"));
    playChime.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not ring for what was already there on the first load", () => {
    const { rerender } = renderAlerts(null);

    rerender({ keys: ["1", "2"] });

    expect(playChime).not.toHaveBeenCalled();
  });

  it("rings once when a new key appears, and not again for the same one", () => {
    const { rerender } = renderAlerts(["1"]);

    rerender({ keys: ["1", "2", "3"] });
    jest.setSystemTime(Date.now() + MIN_SOUND_GAP_MS);
    rerender({ keys: ["1", "2", "3"] });
    rerender({ keys: ["2"] });

    expect(playChime).toHaveBeenCalledTimes(1);
    expect(playChime).toHaveBeenCalledWith(CHIME.KITCHEN);
  });

  it("rings again when a key comes back after leaving", () => {
    const { rerender } = renderAlerts(["waiter-3@a"]);

    rerender({ keys: [] });
    rerender({ keys: ["waiter-3@b"] });

    expect(playChime).toHaveBeenCalledTimes(1);
  });

  it("waits at least 5 s between sounds", () => {
    const { rerender } = renderAlerts([]);

    rerender({ keys: ["1"] });
    jest.setSystemTime(Date.now() + MIN_SOUND_GAP_MS - 1);
    rerender({ keys: ["1", "2"] });
    jest.setSystemTime(Date.now() + 1);
    rerender({ keys: ["1", "2", "3"] });

    expect(playChime).toHaveBeenCalledTimes(2);
  });

  it("stays silent while the sound is off", () => {
    const { rerender } = renderAlerts([], { enabled: false });

    rerender({ keys: ["1"] });

    expect(playChime).not.toHaveBeenCalled();
  });

  it("stays silent outside the admin layout", () => {
    const { rerender } = renderHook(({ keys }) => useSoundAlerts(keys, CHIME.HALL), { initialProps: { keys: [] } });

    rerender({ keys: ["1"] });

    expect(playChime).not.toHaveBeenCalled();
  });
});

describe("sound switch", () => {
  function Switch() {
    const { enabled, toggle } = useSound();
    return (
      <button type="button" onClick={toggle}>
        {enabled ? "on" : "off"}
      </button>
    );
  }

  beforeEach(() => {
    playChime.mockClear();
    window.localStorage.clear();
  });

  it("starts off, plays a test chime when turned on and remembers it on this device", () => {
    render(
      <SoundProvider>
        <Switch />
      </SoundProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "off" }));

    expect(screen.getByRole("button", { name: "on" })).toBeInTheDocument();
    expect(playChime).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem(SOUND_STORAGE_KEY))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "on" }));
    expect(playChime).toHaveBeenCalledTimes(1);
  });
});

describe("tab title", () => {
  it("puts the number of pending alerts in front", () => {
    expect(titleWithCount("iCard", 2)).toBe("(2) iCard");
    expect(titleWithCount("iCard", 0)).toBe("iCard");
  });

  it("restores the title when the panel closes", () => {
    document.title = "iCard";
    const { rerender, unmount } = renderHook(({ count }) => useTitleCount(count), { initialProps: { count: 1 } });

    expect(document.title).toBe("(1) iCard");
    rerender({ count: 0 });
    expect(document.title).toBe("iCard");
    rerender({ count: 3 });
    unmount();
    expect(document.title).toBe("iCard");
  });
});
