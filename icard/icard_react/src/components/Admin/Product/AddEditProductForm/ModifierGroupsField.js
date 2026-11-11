import React, { useEffect } from "react";
import { Form } from "semantic-ui-react";
import { useModifierGroup } from "../../../../hooks";
import { choicesHint } from "../../../../utils/modifiers";
import { notifyError } from "../../../../utils/notify";

export function modifierGroupInitialValues(product) {
  return { modifierGroupIds: product?.modifier_group_ids ?? [] };
}

function sameIds(first, second) {
  const sorted = (ids) => [...ids].sort((a, b) => a - b).join(",");
  return sorted(first) === sorted(second);
}

export function modifierGroupsChanged(values, product) {
  return !sameIds(values.modifierGroupIds, product?.modifier_group_ids ?? []);
}

export function withoutModifierGroups({ modifierGroupIds, ...values }) {
  return values;
}

function toOptions(groups) {
  return (groups ?? []).map((group) => ({
    key: group.id,
    value: group.id,
    text: group.active ? `${group.name} (${choicesHint(group)})` : `${group.name} (inactivo)`,
  }));
}

export function ModifierGroupsField({ formik }) {
  const { modifierGroups, getModifierGroups } = useModifierGroup();

  useEffect(() => {
    getModifierGroups().catch(notifyError);
  }, [getModifierGroups]);

  return (
    <Form.Dropdown
      id="product-modifier-groups"
      label="Opciones del producto"
      placeholder="Sin opciones"
      fluid
      multiple
      search
      selection
      loading={modifierGroups === null}
      options={toOptions(modifierGroups)}
      value={formik.values.modifierGroupIds}
      onChange={(_, data) => formik.setFieldValue("modifierGroupIds", data.value)}
    />
  );
}
