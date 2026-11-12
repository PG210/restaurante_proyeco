import { useEffect, useRef } from "react";
import { useSound } from "../context/SoundContext";

const KEY_SEPARATOR = "\n";

/**
 * Rings when a key appears that was not there in the previous poll. `keys` is null until the
 * first load: whatever is already there when the page opens does not ring.
 */
export function useSoundAlerts(keys, kind) {
  const { play } = useSound();
  const previousKeys = useRef(null);
  const signature = keys === null ? null : keys.join(KEY_SEPARATOR);

  useEffect(() => {
    if (signature === null) return;
    const currentKeys = new Set(signature.split(KEY_SEPARATOR).filter(Boolean));
    const previous = previousKeys.current;
    previousKeys.current = currentKeys;
    if (previous === null) return;
    if ([...currentKeys].some((key) => !previous.has(key))) play(kind);
  }, [signature, play, kind]);
}

/** "(2) iCard" while there are pending alerts, so they show even with the tab in the background. */
export function titleWithCount(baseTitle, count) {
  return count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
}

export function useTitleCount(count) {
  const baseTitle = useRef(document.title);

  useEffect(() => {
    document.title = titleWithCount(baseTitle.current, count);
  }, [count]);

  useEffect(() => {
    const title = baseTitle.current;
    return () => {
      document.title = title;
    };
  }, []);
}
