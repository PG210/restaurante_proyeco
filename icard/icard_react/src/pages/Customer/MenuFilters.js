import React, { useState } from "react";
import { Button, Form, Icon, Label, Message, Segment } from "semantic-ui-react";
import {
  ALLERGEN_NOTICE,
  EMPTY_MENU_FILTERS,
  allergenSummary,
  hasMenuFilters,
  labelOptions,
} from "../../utils/labels";
import "./MenuFilters.scss";

export function MenuFilters({ labels, filters, onChange }) {
  const [open, setOpen] = useState(false);
  const count = filters.allergenIds.length + filters.tagIds.length;
  const set = (field) => (_, data) => onChange({ ...filters, [field]: data.value });

  return (
    <div className="menu-filters">
      <Button basic size="small" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="filter" /> Filtros{count ? ` (${count})` : ""}
      </Button>
      {open && (
        <Segment>
          {labels === null ? (
            <p>Cargando filtros...</p>
          ) : (
            <Form>
              <Form.Dropdown
                id="menu-filter-allergens"
                label="Ocultar lo que contenga"
                placeholder="Elige alérgenos"
                fluid
                multiple
                selection
                options={labelOptions(labels.allergens)}
                value={filters.allergenIds}
                onChange={set("allergenIds")}
              />
              <Form.Dropdown
                id="menu-filter-tags"
                label="Mostrar solo"
                placeholder="Elige etiquetas"
                fluid
                multiple
                selection
                options={labelOptions(labels.tags)}
                value={filters.tagIds}
                onChange={set("tagIds")}
              />
              {hasMenuFilters(filters) && (
                <Button basic size="small" type="button" onClick={() => onChange(EMPTY_MENU_FILTERS)}>
                  Quitar filtros
                </Button>
              )}
            </Form>
          )}
        </Segment>
      )}
      {filters.allergenIds.length > 0 && <Message warning size="small" content={ALLERGEN_NOTICE} />}
    </div>
  );
}

export function ProductLabels({ product }) {
  const tags = product.tags ?? [];
  return (
    <div className="product-labels">
      {tags.length > 0 && (
        <div className="product-labels__tags">
          {tags.map((tag) => (
            <Label key={tag.id} size="tiny" color="teal">
              {tag.name}
            </Label>
          ))}
        </div>
      )}
      <div className="product-labels__allergens">{allergenSummary(product)}</div>
    </div>
  );
}
