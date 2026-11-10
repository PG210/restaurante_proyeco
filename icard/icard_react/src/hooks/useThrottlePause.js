import { useCallback, useRef } from "react";
import { getRetryDelayMs, isThrottled } from "../utils/customerErrors";

export function useThrottlePause() {
  const pausedUntil = useRef(0);

  const isPaused = useCallback(() => Date.now() < pausedUntil.current, []);

  const pauseOnThrottle = useCallback((error) => {
    if (isThrottled(error)) pausedUntil.current = Date.now() + getRetryDelayMs(error);
  }, []);

  return { isPaused, pauseOnThrottle };
}
