import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { productApi } from "../../../api/product";
import { AuthContext } from "../../../context/AuthContext";
import { STOCK_FORM_MODE, StockForm, StockHistory } from "../../../components/Admin";
import { stockInitialValues, toProductPayload } from "../../../components/Admin/Product/AddEditProductForm/StockFields";
import { formatChange } from "../../../components/Admin/Stock/StockHistory";
import { NOTIFICATION_TYPE, buildNotifications } from "../../../utils/notifications";
import { AvailabilityAdmin } from "../AvailabilityAdmin";

jest.mock("../../../api/product", () => ({
  productApi: {
    list: jest.fn(),
    setAvailability: jest.fn(),
    restock: jest.fn(),
    addStock: jest.fn(),
    setStock: jest.fn(),
    stockMovements: jest.fn(),
  },
}));

const FLAN = {
  id: 11,
  title: "Flan",
  active: true,
  is_available: true,
  sold_out_today: false,
  category: null,
  category_data: null,
  stock: 3,
  low_stock_threshold: 5,
  low_stock: true,
  sold_today: 7,
};
const LUNCH = { ...FLAN, id: 12, title: "Almuerzo", stock: null, low_stock_threshold: null, low_stock: false, sold_today: null };
const KITCHEN = { is_staff: false, permissions: ["set_product_availability", "manage_stock"] };
const AVAILABILITY_ONLY = { is_staff: false, permissions: ["set_product_availability"] };

function renderAvailability(user) {
  return render(
    <AuthContext.Provider value={{ auth: { me: user } }}>
      <AvailabilityAdmin />
    </AuthContext.Provider>,
  );
}

function rowFor(title) {
  return screen.getByText(title).closest("tr");
}

describe("product form stock payload", () => {
  const VALUES = { title: "Flan", price: "3.00", trackStock: true, stock: 3, low_stock_threshold: 5 };

  it("starts without stock control for products that do not track it", () => {
    expect(stockInitialValues(LUNCH)).toEqual({ trackStock: false, stock: "", low_stock_threshold: "" });
    expect(stockInitialValues(undefined)).toEqual({ trackStock: false, stock: "", low_stock_threshold: "" });
  });

  it("does not resend unchanged stock so it cannot overwrite sales made meanwhile", () => {
    expect(toProductPayload(VALUES, FLAN)).toEqual({ title: "Flan", price: "3.00", low_stock_threshold: 5 });
  });

  it("sends the stock when it changes or when control is turned on", () => {
    expect(toProductPayload({ ...VALUES, stock: 10 }, FLAN)).toMatchObject({ stock: 10 });
    expect(toProductPayload({ ...VALUES, stock: 20 }, LUNCH)).toMatchObject({ stock: 20 });
  });

  it("clears the stock to turn control off and leaves untracked products alone", () => {
    expect(toProductPayload({ ...VALUES, trackStock: false }, FLAN)).toMatchObject({ stock: "", low_stock_threshold: "" });
    expect(toProductPayload({ ...VALUES, trackStock: false }, LUNCH)).toEqual({ title: "Flan", price: "3.00" });
  });
});

describe("AvailabilityAdmin with stock", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    productApi.list.mockResolvedValue([FLAN, LUNCH]);
  });

  it("shows stock, sales today and actions only for tracked products", async () => {
    renderAvailability(KITCHEN);
    await screen.findByText("Flan");

    const flanRow = within(rowFor("Flan"));
    expect(flanRow.getByText("3")).toBeInTheDocument();
    expect(flanRow.getByText("7")).toBeInTheDocument();
    expect(flanRow.getByRole("button", { name: "Sumar" })).toBeInTheDocument();
    expect(within(rowFor("Almuerzo")).getByText("Sin control")).toBeInTheDocument();
    expect(within(rowFor("Almuerzo")).queryByRole("button", { name: "Sumar" })).not.toBeInTheDocument();
    expect(rowFor("Flan")).toHaveClass("warning");
  });

  it("hides stock for users who can only mark products sold out", async () => {
    renderAvailability(AVAILABILITY_ONLY);
    await screen.findByText("Flan");

    expect(screen.queryByText("Sin control")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sumar" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Agotado hoy: Flan")).toBeInTheDocument();
  });

  it("adds units from the modal and updates the row", async () => {
    productApi.addStock.mockResolvedValue({ ...FLAN, stock: 15, low_stock: false });
    renderAvailability(KITCHEN);

    await screen.findByText("Flan");
    fireEvent.click(within(rowFor("Flan")).getByRole("button", { name: "Sumar" }));
    fireEvent.change(screen.getByLabelText("Unidades que llegaron"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Sumar unidades" }));

    await waitFor(() => expect(productApi.addStock).toHaveBeenCalledWith(11, 12));
    await waitFor(() => expect(within(rowFor("Flan")).getByText("15")).toBeInTheDocument());
  });
});

describe("StockForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("requires a reason to adjust after a count", async () => {
    render(<StockForm product={FLAN} mode={STOCK_FORM_MODE.SET} onSaved={jest.fn()} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("Unidades contadas"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajustar stock" }));

    expect(await screen.findByText("Escribe el motivo del ajuste")).toBeInTheDocument();
    expect(productApi.setStock).not.toHaveBeenCalled();
  });

  it("adjusts with the counted units and the reason", async () => {
    const onSaved = jest.fn();
    productApi.setStock.mockResolvedValue({ ...FLAN, stock: 2 });
    render(<StockForm product={FLAN} mode={STOCK_FORM_MODE.SET} onSaved={onSaved} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("Unidades contadas"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: " Conteo de cierre " } });
    fireEvent.click(screen.getByRole("button", { name: "Ajustar stock" }));

    await waitFor(() => expect(productApi.setStock).toHaveBeenCalledWith(11, 2, "Conteo de cierre"));
    expect(onSaved).toHaveBeenCalledWith({ ...FLAN, stock: 2 });
  });

  it("does not add zero units", async () => {
    render(<StockForm product={FLAN} mode={STOCK_FORM_MODE.ADD} onSaved={jest.fn()} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("Unidades que llegaron"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Sumar unidades" }));

    expect(await screen.findByText("Mínimo 1")).toBeInTheDocument();
    expect(productApi.addStock).not.toHaveBeenCalled();
  });
});

describe("StockHistory", () => {
  it("lists the movements with their reason and sign", async () => {
    productApi.stockMovements.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          change: -2,
          stock_after: 3,
          reason_label: "Pedido",
          note: "",
          created_by_name: "Cliente (QR)",
          created_at: "2026-11-10T17:00:00Z",
        },
      ],
    });
    render(<StockHistory product={FLAN} />);

    expect(await screen.findByText("Pedido")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument();
    expect(screen.getByText("Cliente (QR)")).toBeInTheDocument();
    expect(formatChange(4)).toBe("+4");
  });
});

describe("low stock notifications", () => {
  it("tells who manages stock which products are running low", () => {
    const notifications = buildNotifications([], [], "2026-11-10T00:00:00Z", {
      lowStockProducts: [FLAN],
      stockPath: "/admin/availability",
    });

    expect(notifications).toEqual([
      expect.objectContaining({ type: NOTIFICATION_TYPE.STOCK, text: "Quedan 3 de Flan", path: "/admin/availability" }),
    ]);
  });
});
