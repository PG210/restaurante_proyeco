import React, { useCallback, useEffect, useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { Icon, Label, Loader, Message } from "semantic-ui-react";
import "./CustomerLayout.scss";
import { customerApi } from "../../api/customer";
import { CustomerContext } from "../../context/CustomerContext";
import { useCart, usePolling, useThrottlePause } from "../../hooks";
import { CUSTOMER_POLL_MS } from "../../utils/constants";
import { CUSTOMER_ERROR_VIEW, getCustomerErrorView } from "../../utils/customerErrors";
import { customerPath } from "../../utils/customerPaths";

const BLOCKING_MESSAGES = {
  [CUSTOMER_ERROR_VIEW.INVALID_QR]: {
    header: "Código QR no válido",
    content: "Este código QR no es válido. Pide ayuda al personal.",
  },
  [CUSTOMER_ERROR_VIEW.GENERIC]: {
    header: "No pudimos cargar la carta",
    content: "Revisa tu conexión. Lo volveremos a intentar en unos segundos.",
  },
};

const CLOSED_TABLE_MESSAGE = {
  header: "La mesa aún no está habilitada",
  content: "Llama al mesero para que la abra. Esta pantalla se actualizará sola.",
};

export function CustomerLayout({ children }) {
  const { token } = useParams();
  const [table, setTable] = useState(null);
  const [errorView, setErrorView] = useState(null);
  const { isPaused, pauseOnThrottle } = useThrottlePause();
  const cart = useCart(token);

  const loadTable = useCallback(async () => {
    if (isPaused()) return;
    try {
      setTable(await customerApi.getTable(token));
      setErrorView(null);
    } catch (error) {
      pauseOnThrottle(error);
      setErrorView(getCustomerErrorView(error));
    }
  }, [token, isPaused, pauseOnThrottle]);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  usePolling(loadTable, CUSTOMER_POLL_MS);

  const contextValue = { token, table, setTable, cart, isPaused, pauseOnThrottle };

  const blockingMessage = getBlockingMessage(table, errorView);

  return (
    <div className="customer-layout">
      <header className="customer-layout__header">
        <span>iCard</span>
        {table && <span>Mesa {table.number}</span>}
      </header>

      <main className="customer-layout__content">
        {errorView === CUSTOMER_ERROR_VIEW.THROTTLED && (
          <Message warning size="small" content="Demasiadas solicitudes. Espera unos segundos." />
        )}
        {renderContent({ table, blockingMessage, contextValue, children })}
      </main>

      {table?.is_open && !blockingMessage && <CustomerNav token={token} cartCount={cart.count} />}
    </div>
  );
}

function getBlockingMessage(table, errorView) {
  if (BLOCKING_MESSAGES[errorView]) return BLOCKING_MESSAGES[errorView];
  if (table && !table.is_open) return CLOSED_TABLE_MESSAGE;
  return null;
}

function renderContent({ table, blockingMessage, contextValue, children }) {
  if (blockingMessage) {
    return <Message info header={blockingMessage.header} content={blockingMessage.content} />;
  }
  if (!table) {
    return (
      <Loader active inline="centered">
        Cargando...
      </Loader>
    );
  }
  return <CustomerContext.Provider value={contextValue}>{children}</CustomerContext.Provider>;
}

function CustomerNav({ token, cartCount }) {
  return (
    <nav className="customer-layout__nav">
      <NavLink end to={customerPath(token)}>
        <Icon name="book" />
        Carta
      </NavLink>
      <NavLink to={customerPath(token, "cart")}>
        <Icon name="shopping basket" />
        Carrito
        {cartCount > 0 && (
          <Label circular color="red" size="mini">
            {cartCount}
          </Label>
        )}
      </NavLink>
      <NavLink to={customerPath(token, "orders")}>
        <Icon name="list" />
        Mis pedidos
      </NavLink>
    </nav>
  );
}
