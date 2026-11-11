import React from "react";
import { Icon, Menu } from "semantic-ui-react";
import { Link, useLocation } from "react-router-dom";
import "./LateralMenu.scss";
import { useAuth } from "../../../hooks";
import { getMenuSections, isSectionActive } from "../../../utils/adminSections";

export function LateralMenu({ children }) {
  const { pathname } = useLocation();

  return (
    <div className="side-menu-admin">
      <MenuLeft pathname={pathname} />
      <div className="side-menu-admin__content">{children}</div>
    </div>
  );
}

function MenuLeft({ pathname }) {
  const { auth } = useAuth();

  return (
    <Menu fixed="left" borderless className="side" vertical>
      {getMenuSections(auth.me).map((section) => (
        <Menu.Item key={section.path} as={Link} to={section.path} active={isSectionActive(section, pathname)}>
          <Icon name={section.icon} /> {section.label}
        </Menu.Item>
      ))}
    </Menu>
  );
}
