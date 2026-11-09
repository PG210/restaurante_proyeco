import { useEffect, useRef } from "react";

export function usePolling(callback, intervalMs, enabled = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;
    const intervalId = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(intervalId);
  }, [intervalMs, enabled]);
}
