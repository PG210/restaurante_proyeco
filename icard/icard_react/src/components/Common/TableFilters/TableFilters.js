import React from "react";
import { Button, Dropdown, Input, Message } from "semantic-ui-react";
import "./TableFilters.scss";
import { ALL_VALUES } from "../../../utils/tableFilters";

export function TableFilters({ state, selects = [], searchPlaceholder = "Buscar" }) {
  const { search, setSearch, filters, setFilter, reset, filtered, total } = state;
  const shown = filtered.length;

  return (
    <>
      <div className="table-filters">
        <Input
          className="table-filters__search"
          icon="search"
          iconPosition="left"
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          value={search}
          onChange={(_, data) => setSearch(data.value)}
        />
        {selects.map(({ name, label, options }) => (
          <Dropdown
            key={name}
            selection
            aria-label={label}
            placeholder={label}
            options={[{ key: "all", text: `${label}: todos`, value: ALL_VALUES }, ...options]}
            value={filters[name] ?? ALL_VALUES}
            onChange={(_, data) => setFilter(name, data.value)}
          />
        ))}
        <Button basic type="button" onClick={reset}>
          Limpiar
        </Button>
        <span className="table-filters__count">
          Mostrando {shown} de {total}
        </span>
      </div>
      {total > 0 && shown === 0 && (
        <Message info size="small">
          No hay resultados con estos filtros.{" "}
          <Button basic size="mini" type="button" onClick={reset}>
            Limpiar filtros
          </Button>
        </Message>
      )}
    </>
  );
}
