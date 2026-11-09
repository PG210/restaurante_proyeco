import { useCallback, useState } from "react";

export function useRequestState() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(async (operation) => {
    setLoading(true);
    setError(null);
    try {
      return await operation();
    } catch (requestError) {
      setError(requestError);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, run };
}
