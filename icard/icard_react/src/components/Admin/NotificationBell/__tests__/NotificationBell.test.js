import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NOTIFICATION_TYPE } from "../../../../utils/notifications";
import { NotificationBell } from "../NotificationBell";

const BILL = {
  key: "bill-2",
  type: NOTIFICATION_TYPE.BILL,
  tableId: 2,
  tableNumber: 7,
  text: "Mesa 7 pide la cuenta",
};
const ORDER = {
  key: "order-1",
  type: NOTIFICATION_TYPE.ORDER,
  tableId: 1,
  tableNumber: 5,
  text: "Mesa 5 hizo un pedido (2 productos)",
};

function renderBell(notifications) {
  const handlers = { onSelect: jest.fn(), onMarkRead: jest.fn() };
  render(<NotificationBell notifications={notifications} {...handlers} />);
  fireEvent.click(screen.getByLabelText(`Notificaciones: ${notifications.length}`));
  return handlers;
}

describe("NotificationBell", () => {
  it("shows how many notifications there are", () => {
    renderBell([BILL, ORDER]);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("lists which table ordered and which table wants the bill", () => {
    renderBell([BILL, ORDER]);

    expect(screen.getByText("Mesa 7 pide la cuenta")).toBeInTheDocument();
    expect(screen.getByText("Mesa 5 hizo un pedido (2 productos)")).toBeInTheDocument();
  });

  it("opens the table when a notification is clicked", () => {
    const { onSelect } = renderBell([ORDER]);

    fireEvent.click(screen.getByText("Mesa 5 hizo un pedido (2 productos)"));

    expect(onSelect).toHaveBeenCalledWith(ORDER);
  });

  it("marks orders as read", () => {
    const { onMarkRead } = renderBell([ORDER]);

    fireEvent.click(screen.getByText("Marcar pedidos como leídos"));

    expect(onMarkRead).toHaveBeenCalled();
  });

  it("does not offer to mark bill requests as read", () => {
    renderBell([BILL]);

    expect(screen.queryByText("Marcar pedidos como leídos")).not.toBeInTheDocument();
  });

  it("says there is nothing new and hides the counter", () => {
    renderBell([]);

    expect(screen.getByText("Sin novedades")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
