import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CHIME, playChime } from "../utils/sound";
import { readJson, writeJson } from "../utils/storage";

/** Remembered per device: the kitchen may want sound and the office may not. */
export const SOUND_STORAGE_KEY = "icard-sound-enabled";
/** At most one sound every 5 s, however many alerts arrive at rush hour. */
export const MIN_SOUND_GAP_MS = 5000;

const SILENT = { enabled: false, toggle: () => {}, play: () => false };

const SoundContext = createContext(SILENT);

export function SoundProvider({ children }) {
  const [enabled, setEnabled] = useState(() => readJson(SOUND_STORAGE_KEY, false) === true);
  const lastPlayedAt = useRef(null);

  useEffect(() => {
    writeJson(SOUND_STORAGE_KEY, enabled);
  }, [enabled]);

  const play = useCallback(
    (kind) => {
      if (!enabled) return false;
      const now = Date.now();
      if (lastPlayedAt.current !== null && now - lastPlayedAt.current < MIN_SOUND_GAP_MS) return false;
      lastPlayedAt.current = now;
      return playChime(kind);
    },
    [enabled],
  );

  // The test chime plays inside the click: browsers only allow sound after the page is touched.
  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    if (next) playChime(CHIME.HALL);
  }, [enabled]);

  const value = useMemo(() => ({ enabled, toggle, play }), [enabled, toggle, play]);

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

/** Outside a SoundProvider it stays silent, so pages render the same in tests. */
export function useSound() {
  return useContext(SoundContext);
}
