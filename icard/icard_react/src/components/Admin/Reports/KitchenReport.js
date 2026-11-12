import React from "react";
import { Header, Label, Message, Segment, Statistic, Table } from "semantic-ui-react";
import { EMPTY_VALUE } from "../../../utils/constants";
import { formatDuration } from "../../../utils/preparation";
import {
  KITCHEN_NOTE,
  NO_KITCHEN_DATA_MESSAGE,
  forgottenText,
  formatHourLabel,
  maxAmount,
  measuredSinceText,
} from "../../../utils/salesReports";
import { BarCell } from "./BarCell";
import { ReportNote } from "./ReportNote";

export const REVIEW_ESTIMATE_LABEL = "Revisar estimado";

const STAGES = [
  { key: "preparation", label: "Preparación" },
  { key: "wait", label: "Espera hasta empezar" },
  { key: "delivery", label: "Entrega a la mesa" },
];

function percentText(value) {
  return value === null || value === undefined ? EMPTY_VALUE : `${value} %`;
}

export function KitchenReport({ data }) {
  const { overall } = data;

  return (
    <>
      <ReportNote>{KITCHEN_NOTE}</ReportNote>
      <ReportNote>{measuredSinceText(data.measured_since)}</ReportNote>
      {overall.forgotten > 0 && <Message warning content={forgottenText(overall.forgotten)} />}
      {overall.preparation.count === 0 ? (
        <Message info content={NO_KITCHEN_DATA_MESSAGE} />
      ) : (
        <>
          <Overall overall={overall} />
          <Header as="h4">Por producto</Header>
          <Products rows={data.products} />
          <Header as="h4">Preparación según la hora en que entra a cocina</Header>
          <ByHour rows={data.by_hour.filter((row) => row.count > 0)} />
        </>
      )}
    </>
  );
}

function Overall({ overall }) {
  return (
    <Segment role="region" aria-label="Tiempos de cocina">
      <Statistic.Group size="mini" widths={4}>
        {STAGES.map((stage) => (
          <Statistic
            key={stage.key}
            label={`${stage.label} (mediana)`}
            value={formatDuration(overall[stage.key].median)}
          />
        ))}
        <Statistic label="Listos a tiempo" value={percentText(overall.on_time_percent)} />
      </Statistic.Group>
      <p className="report-note">
        Promedio de preparación: {formatDuration(overall.preparation.average)} en {overall.preparation.count} pedidos.
      </p>
    </Segment>
  );
}

function Products({ rows }) {
  return (
    <Table compact celled aria-label="Tiempos por producto">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Producto</Table.HeaderCell>
          <Table.HeaderCell>Medidos</Table.HeaderCell>
          <Table.HeaderCell>Mediana</Table.HeaderCell>
          <Table.HeaderCell>Promedio</Table.HeaderCell>
          <Table.HeaderCell>Estimado</Table.HeaderCell>
          <Table.HeaderCell>A tiempo</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.product_id ?? "deleted"}>
            <Table.Cell>
              {row.name}
              {row.review_estimate && <Label color="orange" size="mini" content={REVIEW_ESTIMATE_LABEL} />}
            </Table.Cell>
            <Table.Cell>{row.measured}</Table.Cell>
            <Table.Cell>{formatDuration(row.median)}</Table.Cell>
            <Table.Cell>{formatDuration(row.average)}</Table.Cell>
            <Table.Cell>{formatDuration(row.estimate)}</Table.Cell>
            <Table.Cell>{percentText(row.on_time_percent)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

function ByHour({ rows }) {
  const max = maxAmount(rows, "median");
  return (
    <Table compact celled unstackable aria-label="Preparación por hora">
      <Table.Header>
        <Table.Row>
          <Table.HeaderCell>Hora</Table.HeaderCell>
          <Table.HeaderCell>Mediana</Table.HeaderCell>
          <Table.HeaderCell>Medidos</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.hour}>
            <Table.Cell>{formatHourLabel(row.hour)}</Table.Cell>
            <Table.Cell>
              <BarCell value={row.median} max={max}>
                {formatDuration(row.median)}
              </BarCell>
            </Table.Cell>
            <Table.Cell>{row.count}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
