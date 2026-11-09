import { toast } from "react-toastify";

const DEFAULT_ERROR_MESSAGE = "Ocurrió un error inesperado. Intenta de nuevo.";

export function notifyError(error) {
  const message = error?.message || DEFAULT_ERROR_MESSAGE;
  toast.error(message, { toastId: message });
}
