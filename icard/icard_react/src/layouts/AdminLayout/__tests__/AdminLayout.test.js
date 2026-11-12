import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "../../../context/AuthContext";
import { ADMIN_HOME_PATH, DASHBOARD_PATH } from "../../../utils/adminSections";
import { AdminLayout } from "../AdminLayout";

jest.mock("../../../pages/Admin", () => ({ LoginAdmin: () => <p>Iniciar sesión</p> }));
jest.mock("../../../components/Admin", () => ({
  TopMenu: () => null,
  LateralMenu: ({ children }) => <div>{children}</div>,
}));

const ADMIN = { is_staff: true, permissions: [] };
const WAITER = { is_staff: false, permissions: ["view_order"] };

function app(auth) {
  return (
    <AuthContext.Provider value={{ auth }}>
      <MemoryRouter initialEntries={[ADMIN_HOME_PATH]}>
        <Routes>
          <Route path={ADMIN_HOME_PATH} element={<AdminLayout>Pedidos</AdminLayout>} />
          <Route path={DASHBOARD_PATH} element={<AdminLayout>Resumen</AdminLayout>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("AdminLayout landing", () => {
  it("takes the admin to the summary right after logging in", () => {
    const { rerender } = render(app(null));
    expect(screen.getByText("Iniciar sesión")).toBeInTheDocument();

    rerender(app({ me: ADMIN }));

    expect(screen.getByText("Resumen")).toBeInTheDocument();
  });

  it("keeps the waiter on the orders page", () => {
    const { rerender } = render(app(null));

    rerender(app({ me: WAITER }));

    expect(screen.getByText("Pedidos")).toBeInTheDocument();
  });

  it("lets an admin with a restored session open the orders page", () => {
    const { rerender } = render(app(undefined));

    rerender(app({ me: ADMIN }));

    expect(screen.getByText("Pedidos")).toBeInTheDocument();
  });
});
