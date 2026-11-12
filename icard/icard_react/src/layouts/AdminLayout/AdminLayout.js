import React, { useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { LoginAdmin } from "../../pages/Admin";
import { useAuth } from "../../hooks";
import { TopMenu, LateralMenu } from "../../components/Admin";
import { SoundProvider } from "../../context/SoundContext";
import { landingPath } from "../../utils/adminSections";
import "./AdminLayout.scss";

export function AdminLayout({ children }) {
  const { auth } = useAuth();
  const { pathname } = useLocation();
  // Only redirect right after logging in here, not when an admin opens the orders page on purpose.
  const loggedInHere = useRef(auth === null);

  if (!auth) {
    if (auth === null) loggedInHere.current = true;
    return <LoginAdmin />;
  }

  const landing = loggedInHere.current ? landingPath(auth.me, pathname) : null;
  if (landing) return <Navigate to={landing} replace />;

  return (
    <SoundProvider>
      <div className="admin-layout">
        <div className="admin-layout__menu">
          <TopMenu />
        </div>
        <div className="admin-layout__main-content">
          <LateralMenu>{children}</LateralMenu>
        </div>
      </div>
    </SoundProvider>
  );
}
