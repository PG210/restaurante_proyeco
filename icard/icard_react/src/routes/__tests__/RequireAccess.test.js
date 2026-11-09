import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ADMIN_SECTIONS } from "../../utils/adminSections";
import { PERMISSIONS } from "../../utils/permissions";
import { RequireAccess } from "../RequireAccess";

const PROTECTED_TEXT = "Página protegida";

function renderSection(section, user) {
  const { orders } = ADMIN_SECTIONS;
  return render(
    <AuthContext.Provider value={{ auth: { me: user }, login: jest.fn(), logout: jest.fn() }}>
      <MemoryRouter initialEntries={[section.path]}>
        <Routes>
          {section !== orders && <Route path={orders.path} element={<p>Inicio del panel</p>} />}
          <Route
            path={section.path}
            element={
              <RequireAccess route={section}>
                <p>{PROTECTED_TEXT}</p>
              </RequireAccess>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("RequireAccess", () => {
  it("redirects a non-staff user away from an admin-only page", () => {
    renderSection(ADMIN_SECTIONS.users, { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER] });

    expect(screen.getByText("Inicio del panel")).toBeInTheDocument();
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
  });

  it("renders an admin-only page for a staff user", () => {
    renderSection(ADMIN_SECTIONS.users, { is_staff: true, permissions: [] });

    expect(screen.getByText(PROTECTED_TEXT)).toBeInTheDocument();
  });

  it("renders the kitchen for a user with the prepare permission", () => {
    renderSection(ADMIN_SECTIONS.kitchen, { is_staff: false, permissions: [PERMISSIONS.PREPARE_ORDER] });

    expect(screen.getByText(PROTECTED_TEXT)).toBeInTheDocument();
  });

  it("redirects a user without the prepare permission away from the kitchen", () => {
    renderSection(ADMIN_SECTIONS.kitchen, { is_staff: false, permissions: [PERMISSIONS.VIEW_ORDER] });

    expect(screen.getByText("Inicio del panel")).toBeInTheDocument();
  });

  it("explains the missing permissions instead of redirecting in a loop", () => {
    renderSection(ADMIN_SECTIONS.orders, { is_staff: false, permissions: [] });

    expect(screen.getByText("Sin permisos")).toBeInTheDocument();
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
  });
});
