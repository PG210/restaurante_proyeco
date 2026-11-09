import React from "react";
import { Navigate } from "react-router-dom";
import { Message } from "semantic-ui-react";
import { useAuth } from "../hooks";
import { ADMIN_MENU, canAccessSection, getVisibleSections } from "../utils/adminSections";

export function RequireAccess({ route, children }) {
  const { auth } = useAuth();
  const user = auth?.me;

  if (canAccessSection(route, user)) return children;

  const [fallbackSection] = getVisibleSections(ADMIN_MENU, user);
  if (fallbackSection) return <Navigate to={fallbackSection.path} replace />;

  return (
    <Message warning>
      <Message.Header>Sin permisos</Message.Header>
      <p>Tu usuario no tiene permisos asignados. Pide a un administrador que te asigne un rol.</p>
    </Message>
  );
}
