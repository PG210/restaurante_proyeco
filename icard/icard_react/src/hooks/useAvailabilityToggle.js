import { useCallback, useState } from "react";
import { productApi } from "../api/product";
import { notifyError } from "../utils/notify";

export function useAvailabilityToggle(onUpdated) {
  const [togglingId, setTogglingId] = useState(null);

  const toggleAvailability = useCallback(
    async (product, isAvailable) => {
      setTogglingId(product.id);
      try {
        onUpdated(await productApi.setAvailability(product.id, isAvailable));
      } catch (error) {
        notifyError(error);
      } finally {
        setTogglingId(null);
      }
    },
    [onUpdated],
  );

  return { togglingId, toggleAvailability };
}
