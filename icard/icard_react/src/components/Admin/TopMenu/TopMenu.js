import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon, Menu } from "semantic-ui-react";
import "./TopMenu.scss";
import { useAuth, useNotifications } from "../../../hooks";
import { tableDetailPath } from "../../../utils/adminSections";
import { NotificationBell } from "../NotificationBell";

function displayName(user) {
  if (user?.first_name && user?.last_name) return `${user.first_name} ${user.last_name}`;
  return user?.email;
}

export function TopMenu() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const { enabled, notifications, markOrdersAsRead } = useNotifications(auth.me);

  return (
    <Menu fixed="top" className="top-menu-admin">
      <Menu.Item className="top-menu-admin__logo">
        <p>Icard Admin</p>
      </Menu.Item>

      <Menu.Menu position="right">
        {enabled && (
          <Menu.Item>
            <NotificationBell
              notifications={notifications}
              onSelect={(notification) => navigate(notification.path ?? tableDetailPath(notification.tableId))}
              onMarkRead={markOrdersAsRead}
            />
          </Menu.Item>
        )}

        <Menu.Item>Hola, {displayName(auth.me)}</Menu.Item>

        <Menu.Item onClick={logout} aria-label="Cerrar sesión">
          <Icon name="sign-out" />
        </Menu.Item>
      </Menu.Menu>
    </Menu>
  );
}
