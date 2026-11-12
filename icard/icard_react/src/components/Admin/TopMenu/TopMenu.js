import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon, Menu } from "semantic-ui-react";
import "./TopMenu.scss";
import { useSound } from "../../../context/SoundContext";
import { useAuth, useNotifications, useSoundAlerts, useTitleCount } from "../../../hooks";
import { tableDetailPath } from "../../../utils/adminSections";
import { alertKeys } from "../../../utils/notifications";
import { CHIME } from "../../../utils/sound";
import { NotificationBell } from "../NotificationBell";

export function soundToggleLabel(enabled) {
  return enabled ? "Desactivar sonido" : "Activar sonido";
}

function SoundToggle() {
  const { enabled, toggle } = useSound();
  return (
    <Menu.Item onClick={toggle} aria-label={soundToggleLabel(enabled)} aria-pressed={enabled} title={soundToggleLabel(enabled)}>
      <Icon name={enabled ? "volume up" : "volume off"} />
    </Menu.Item>
  );
}

function displayName(user) {
  if (user?.first_name && user?.last_name) return `${user.first_name} ${user.last_name}`;
  return user?.email;
}

export function TopMenu() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const { enabled, loaded, notifications, markOrdersAsRead } = useNotifications(auth.me);

  useSoundAlerts(enabled && loaded ? alertKeys(notifications) : null, CHIME.HALL);
  useTitleCount(enabled ? notifications.length : 0);

  return (
    <Menu fixed="top" className="top-menu-admin">
      <Menu.Item className="top-menu-admin__logo">
        <p>Icard Admin</p>
      </Menu.Item>

      <Menu.Menu position="right">
        <SoundToggle />

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
