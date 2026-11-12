import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header, Label, Loader, Message, Segment, Statistic } from "semantic-ui-react";
import "./DashboardAdmin.scss";
import { reportsApi } from "../../api/reports";
import { HeaderPage } from "../../components/Admin";
import { usePolling } from "../../hooks";
import { CASH_CLOSING_PATH } from "../../utils/adminSections";
import { formatDateTime } from "../../utils/dateRange";
import { formatMoney } from "../../utils/money";
import { notifyError } from "../../utils/notify";
import { DASHBOARD_PERIODS, DASHBOARD_POLL_MS, SALES_NOTE, describeChange, paymentsAfterText } from "../../utils/reports";

export function DashboardAdmin() {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await reportsApi.dashboard());
    } catch (error) {
      notifyError(error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, DASHBOARD_POLL_MS);

  return (
    <>
      <HeaderPage title="Resumen" btnTitle="Actualizar" btnClick={load} />
      {data === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <Dashboard data={data} />
      )}
    </>
  );
}

function Dashboard({ data }) {
  return (
    <>
      <RightNow data={data} />
      {DASHBOARD_PERIODS.map((period) => (
        <PeriodSales key={period.key} period={period} sales={data.sales[period.key]} />
      ))}
      <p className="dashboard-admin__note">{SALES_NOTE}</p>
    </>
  );
}

function PeriodSales({ period, sales }) {
  const change = describeChange(sales.change_percent, period.previous);

  return (
    <Segment role="region" aria-label={period.title}>
      <Header as="h3">
        {period.title}
        <Label color={change.color} basic size="small" content={change.text} />
      </Header>
      <Statistic.Group size="mini" widths={4}>
        <Statistic label="Vendido" value={formatMoney(sales.total)} />
        <Statistic label="Propinas" value={formatMoney(sales.tips)} />
        <Statistic label="Cuentas cerradas" value={sales.bills} />
        <Statistic label="Ticket promedio" value={formatMoney(sales.average_ticket)} />
      </Statistic.Group>
    </Segment>
  );
}

function RightNow({ data }) {
  return (
    <Segment role="region" aria-label="Ahora">
      <Header as="h3">Ahora</Header>
      <Statistic.Group size="mini" widths={3}>
        <Statistic label="Mesas ocupadas" value={`${data.open_tables} de ${data.tables}`} />
        <Statistic label="Pedidos en cocina" value={data.orders_in_kitchen} />
        <Statistic label="Caja de hoy" value={data.cash_register.closed ? "Cerrada" : "Sin cerrar"} />
      </Statistic.Group>
      <CashRegisterStatus register={data.cash_register} />
    </Segment>
  );
}

function CashRegisterStatus({ register }) {
  if (!register.closed) {
    return (
      <p className="dashboard-admin__register">
        <Link to={CASH_CLOSING_PATH}>Cerrar la caja</Link> al terminar la jornada.
      </p>
    );
  }
  const after = paymentsAfterText(register.payments_after);
  return (
    <>
      <p className="dashboard-admin__register">
        Cerrada el {formatDateTime(register.closed_at)} por {register.closed_by_name}.
      </p>
      {after && <Message warning size="small" content={`${after}. Revisa la caja.`} />}
    </>
  );
}
