import React from "react";
import { Dropdown, Icon, Label } from "semantic-ui-react";
import "./NotificationBell.scss";
import { NOTIFICATION_TYPE, hasOrderNotifications } from "../../../utils/notifications";

const NOTIFICATION_ICONS = {
  [NOTIFICATION_TYPE.BILL]: { name: "dollar", color: "red" },
  [NOTIFICATION_TYPE.ORDER]: { name: "food", color: "orange" },
};

export function NotificationBell({ notifications, onSelect, onMarkRead }) {
  const count = notifications.length;

  const trigger = (
    <span className="notification-bell__trigger" aria-label={`Notificaciones: ${count}`}>
      <Icon name="bell" size="large" />
      {count > 0 && (
        <Label circular color="red" size="mini" className="notification-bell__count">
          {count}
        </Label>
      )}
    </span>
  );

  return (
    <Dropdown trigger={trigger} icon={null} pointing="top right" className="notification-bell">
      <Dropdown.Menu>
        <Dropdown.Header content="Notificaciones" />
        {count === 0 && <Dropdown.Item disabled text="Sin novedades" />}
        {notifications.map((notification) => (
          <Dropdown.Item key={notification.key} onClick={() => onSelect(notification)}>
            <Icon {...NOTIFICATION_ICONS[notification.type]} />
            {notification.text}
          </Dropdown.Item>
        ))}
        {hasOrderNotifications(notifications) && (
          <>
            <Dropdown.Divider />
            <Dropdown.Item icon="check" text="Marcar pedidos como leídos" onClick={onMarkRead} />
          </>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}
