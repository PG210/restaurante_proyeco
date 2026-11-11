import React, { useEffect } from "react";
import { Checkbox, Form } from "semantic-ui-react";
import { useAllergens, useModifierGroup, useTags } from "../../../../hooks";
import { labelOptions } from "../../../../utils/labels";
import { choicesHint } from "../../../../utils/modifiers";
import { notifyError } from "../../../../utils/notify";

export const DECLARED_LABEL = "Alérgenos revisados";
const DECLARED_HINT =
  'Márcalo aunque no tenga alérgenos: la carta dirá "Sin alérgenos declarados" en vez de "Consulta los alérgenos al personal".';

export function productLabelInitialValues(product) {
  return {
    modifierGroupIds: product?.modifier_group_ids ?? [],
    allergenIds: product?.allergen_ids ?? [],
    allergensDeclared: Boolean(product?.allergens_declared),
    tagIds: product?.tag_ids ?? [],
  };
}

function sameIds(first, second) {
  const sorted = (ids) => [...ids].sort((a, b) => a - b).join(",");
  return sorted(first) === sorted(second);
}

function isDeclared(values) {
  return values.allergensDeclared || values.allergenIds.length > 0;
}

/** Only the relations that changed, so saving tags does not mark the allergens as reviewed. Null when nothing changed. */
export function labelsPayload(values, product) {
  const initial = productLabelInitialValues(product);
  const payload = {};
  if (!sameIds(values.modifierGroupIds, initial.modifierGroupIds)) payload.modifier_group_ids = values.modifierGroupIds;
  if (!sameIds(values.allergenIds, initial.allergenIds) || isDeclared(values) !== initial.allergensDeclared) {
    payload.allergen_ids = values.allergenIds;
    payload.allergens_declared = isDeclared(values);
  }
  if (!sameIds(values.tagIds, initial.tagIds)) payload.tag_ids = values.tagIds;
  return Object.keys(payload).length ? payload : null;
}

export function withoutLabels({ modifierGroupIds, allergenIds, allergensDeclared, tagIds, ...values }) {
  return values;
}

function groupOptions(groups) {
  return (groups ?? []).map((group) => ({
    key: group.id,
    value: group.id,
    text: group.active ? `${group.name} (${choicesHint(group)})` : `${group.name} (inactivo)`,
  }));
}

function activeOnly(labels) {
  return labels === null ? null : labels.filter((label) => label.active);
}

function useListed(resource) {
  const { items, getItems } = resource;
  useEffect(() => {
    getItems().catch(notifyError);
  }, [getItems]);
  return items;
}

function LabelDropdown({ id, label, placeholder, items, value, onChange }) {
  return (
    <Form.Dropdown
      id={id}
      label={label}
      placeholder={placeholder}
      fluid
      multiple
      search
      selection
      loading={items === null}
      options={labelOptions(items)}
      value={value}
      onChange={(_, data) => onChange(data.value)}
    />
  );
}

export function ProductLabelsField({ formik }) {
  const modifierGroups = useModifierGroup();
  const groups = useListed({ items: modifierGroups.modifierGroups, getItems: modifierGroups.getModifierGroups });
  const allergens = activeOnly(useListed(useAllergens()));
  const tags = activeOnly(useListed(useTags()));
  const { values, setFieldValue } = formik;
  const hasAllergens = values.allergenIds.length > 0;

  return (
    <div className="add-edit-product-form__labels">
      <Form.Dropdown
        id="product-modifier-groups"
        label="Opciones del producto"
        placeholder="Sin opciones"
        fluid
        multiple
        search
        selection
        loading={groups === null}
        options={groupOptions(groups)}
        value={values.modifierGroupIds}
        onChange={(_, data) => setFieldValue("modifierGroupIds", data.value)}
      />
      <LabelDropdown
        id="product-allergens"
        label="Alérgenos"
        placeholder="Sin alérgenos"
        items={allergens}
        value={values.allergenIds}
        onChange={(ids) => setFieldValue("allergenIds", ids)}
      />
      <Form.Field>
        <Checkbox
          id="product-allergens-declared"
          label={DECLARED_LABEL}
          checked={values.allergensDeclared || hasAllergens}
          disabled={hasAllergens}
          onChange={(_, data) => setFieldValue("allergensDeclared", data.checked)}
        />
        <div className="add-edit-product-form__hint">{DECLARED_HINT}</div>
      </Form.Field>
      <LabelDropdown
        id="product-tags"
        label="Etiquetas"
        placeholder="Sin etiquetas"
        items={tags}
        value={values.tagIds}
        onChange={(ids) => setFieldValue("tagIds", ids)}
      />
    </div>
  );
}
