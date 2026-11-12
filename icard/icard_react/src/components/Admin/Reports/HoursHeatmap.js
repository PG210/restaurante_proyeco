import React from "react";
import { Message, Table } from "semantic-ui-react";
import { formatMoney } from "../../../utils/money";
import {
  EMPTY_REPORT_MESSAGE,
  HOURS_NOTE,
  WEEKDAYS,
  busyHours,
  formatHourLabel,
  heatLevel,
  maxAmount,
} from "../../../utils/salesReports";
import { ReportNote } from "./ReportNote";

const NO_AMOUNT = "0";

function cellKey(weekday, hour) {
  return `${weekday}-${hour}`;
}

export function describeSlot(place, orders, amount) {
  return `${place}: ${orders} ${orders === 1 ? "pedido" : "pedidos"}, ${formatMoney(amount)}`;
}

/** Weekdays across, clock hours down; the colour shows how much was ordered in each slot. */
export function HoursHeatmap({ data }) {
  const hours = busyHours(data.by_hour);
  if (!hours.length) return <Message info content={EMPTY_REPORT_MESSAGE} />;

  const cells = new Map(data.cells.map((cell) => [cellKey(cell.weekday, cell.hour), cell]));
  const max = maxAmount(data.cells);
  const byHour = new Map(data.by_hour.map((row) => [row.hour, row]));
  const byWeekday = new Map(data.by_weekday.map((row) => [row.weekday, row]));

  return (
    <>
      <ReportNote>{HOURS_NOTE}</ReportNote>
      <div className="hours-heatmap">
        <Table compact celled unstackable textAlign="center" aria-label="Pedidos por día y hora">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Hora</Table.HeaderCell>
              {WEEKDAYS.map((weekday) => (
                <Table.HeaderCell key={weekday.number}>
                  <abbr title={weekday.label}>{weekday.short}</abbr>
                </Table.HeaderCell>
              ))}
              <Table.HeaderCell>Total</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {hours.map((hour) => (
              <Table.Row key={hour}>
                <Table.HeaderCell>{formatHourLabel(hour)}</Table.HeaderCell>
                {WEEKDAYS.map((weekday) => (
                  <SlotCell
                    key={weekday.number}
                    place={`${weekday.label} ${formatHourLabel(hour)}`}
                    cell={cells.get(cellKey(weekday.number, hour))}
                    max={max}
                  />
                ))}
                <Table.Cell>{byHour.get(hour).orders}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
          <Table.Footer>
            <Table.Row>
              <Table.HeaderCell>Total</Table.HeaderCell>
              {WEEKDAYS.map((weekday) => {
                const total = byWeekday.get(weekday.number);
                return (
                  <Table.HeaderCell key={weekday.number} title={describeSlot(weekday.label, total.orders, total.amount)}>
                    {total.orders}
                  </Table.HeaderCell>
                );
              })}
              <Table.HeaderCell />
            </Table.Row>
          </Table.Footer>
        </Table>
      </div>
    </>
  );
}

function SlotCell({ place, cell, max }) {
  const amount = cell?.amount ?? NO_AMOUNT;
  const label = describeSlot(place, cell?.orders ?? 0, amount);
  return (
    <Table.Cell
      className={`hours-heatmap__cell hours-heatmap__cell--${heatLevel(amount, max)}`}
      aria-label={label}
      title={label}
    >
      {cell?.orders ?? ""}
    </Table.Cell>
  );
}
