import { createContext, useContext } from "react";

export const CustomerContext = createContext(null);

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) throw new Error("useCustomer debe usarse dentro de CustomerLayout");
  return context;
}
