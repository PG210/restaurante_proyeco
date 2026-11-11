import React, { useState } from "react";
import { Button, Form, Icon } from "semantic-ui-react";
import { formatPrice } from "../../../utils/cart";
import { isSelectionValid, offeredGroups, selectedModifiers, selectionErrors, unitPrice } from "../../../utils/modifiers";
import { ModifierPicker } from "./ModifierPicker";

export function ModifierDialog({ product, onConfirm }) {
  const groups = offeredGroups(product);
  const [selected, setSelected] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const modifiers = selectedModifiers(groups, selected);

  const confirm = () => {
    setSubmitted(true);
    if (isSelectionValid(groups, selected)) onConfirm(modifiers);
  };

  return (
    <Form onSubmit={confirm}>
      <ModifierPicker
        groups={groups}
        value={selected}
        onChange={setSelected}
        errors={submitted ? selectionErrors(groups, selected) : {}}
      />
      <Button primary fluid type="submit">
        <Icon name="plus" /> Añadir — {formatPrice(unitPrice(product, modifiers))}
      </Button>
    </Form>
  );
}
