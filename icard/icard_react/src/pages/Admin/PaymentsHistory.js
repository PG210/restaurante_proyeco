import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Loader, Message, Pagination, Segment, Statistic, Table } from "semantic-ui-react";
import { billApi } from "../../api/bill";
import { HeaderPage } from "../../components/Admin";
import { billTicketPath } from "../../utils/adminSections";
import { endOfLocalDayIso, formatDateTime, startOfLocalDayIso, toDateInputValue } from "../../utils/dateRange";
import { formatMoney } from "../../utils/money";
import { notifyError } from "../../utils/notify";
import { BILL_STATUS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "../../utils/paymentMethods";

export const HISTORY_PAGE_SIZE = 50;
const ALL_METHODS_OPTION = { key: "all", value: "", text: "Todos los métodos" };

export function historyFilters({ from, to, tableNumber, method }) {
  return {
    status: BILL_STATUS.PAID,
    closed_at_after: from ? startOfLocalDayIso(from) : undefined,
    closed_at_before: to ? endOfLocalDayIso(to) : undefined,
    table_number: tableNumber || undefined,
    method: method || undefined,
  };
}

function defaultFilters() {
  const today = toDateInputValue();
  return { from: today, to: today, tableNumber: "", method: "" };
}

export function PaymentsHistory() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    const query = historyFilters(filters);
    try {
      const [bills, totals] = await Promise.all([billApi.list({ ...query, page }), billApi.summary(query)]);
      setResult(bills);
      setSummary(totals);
    } catch (error) {
      notifyError(error);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

  return (
    <>
      <HeaderPage title="Historial de pagos" />

      <Form>
        <Form.Group widths="equal">
          <Form.Input label="Desde" type="date" value={filters.from} onChange={(_, data) => updateFilter("from", data.value)} />
          <Form.Input label="Hasta" type="date" value={filters.to} onChange={(_, data) => updateFilter("to", data.value)} />
          <Form.Input
            label="Mesa"
            type="number"
            min="1"
            value={filters.tableNumber}
            onChange={(_, data) => updateFilter("tableNumber", data.value)}
          />
          <Form.Dropdown
            label="Método"
            selection
            options={[ALL_METHODS_OPTION, ...PAYMENT_METHOD_OPTIONS]}
            value={filters.method}
            onChange={(_, data) => updateFilter("method", data.value)}
          />
        </Form.Group>
      </Form>

      {summary && <HistorySummary summary={summary} />}

      {result === null ? (
        <Loader active inline="centered">
          Cargando...
        </Loader>
      ) : (
        <HistoryTable
          result={result}
          page={page}
          onPageChange={setPage}
          onOpenTicket={(bill) => navigate(billTicketPath(bill.id))}
        />
      )}
    </>
  );
}

function HistorySummary({ summary }) {
  return (
    <Segment>
      <Statistic.Group size="mini" widths={4 + summary.by_method.length}>
        <Statistic label="Cuentas" value={summary.bills} />
        <Statistic label="Total cobrado" value={formatMoney(summary.total)} />
        <Statistic label="Impuesto" value={formatMoney(summary.tax)} />
        <Statistic label="Propinas" value={formatMoney(summary.tips)} />
        {summary.by_method.map((row) => (
          <Statistic key={row.method} label={PAYMENT_METHOD_LABELS[row.method] ?? row.method} value={formatMoney(row.amount)} />
        ))}
      </Statistic.Group>
    </Segment>
  );
}

function HistoryTable({ result, page, onPageChange, onOpenTicket }) {
  if (!result.results.length) return <Message info content="No hay cuentas pagadas con estos filtros." />;

  const totalPages = Math.max(Math.ceil(result.count / HISTORY_PAGE_SIZE), 1);

  return (
    <>
      <Table selectable unstackable>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Cierre</Table.HeaderCell>
            <Table.HeaderCell>Mesa</Table.HeaderCell>
            <Table.HeaderCell>Subtotal</Table.HeaderCell>
            <Table.HeaderCell>Propina</Table.HeaderCell>
            <Table.HeaderCell>Total</Table.HeaderCell>
            <Table.HeaderCell>Métodos</Table.HeaderCell>
            <Table.HeaderCell>Cobró</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {result.results.map((bill) => (
            <Table.Row key={bill.id} onClick={() => onOpenTicket(bill)}>
              <Table.Cell>{formatDateTime(bill.closed_at)}</Table.Cell>
              <Table.Cell>{bill.table_number}</Table.Cell>
              <Table.Cell>{formatMoney(bill.subtotal)}</Table.Cell>
              <Table.Cell>{formatMoney(bill.tip_total)}</Table.Cell>
              <Table.Cell>{formatMoney(bill.total_paid)}</Table.Cell>
              <Table.Cell>{bill.methods.map((method) => PAYMENT_METHOD_LABELS[method] ?? method).join(", ")}</Table.Cell>
              <Table.Cell>{bill.closed_by_name}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {totalPages > 1 && (
        <Pagination activePage={page} totalPages={totalPages} onPageChange={(_, data) => onPageChange(data.activePage)} />
      )}
    </>
  );
}
