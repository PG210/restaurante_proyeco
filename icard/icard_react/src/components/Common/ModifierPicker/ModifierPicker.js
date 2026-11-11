import React from "react";
import { Checkbox, Form, Header, Label } from "semantic-ui-react";
import { choicesHint, formatDelta, toggleModifier } from "../../../utils/modifiers";
import "./ModifierPicker.scss";

export function ModifierPicker({ groups, value, onChange, errors = {} }) {
  return (
    <div className="modifier-picker">
      {groups.map((group) => (
        <Form.Field key={group.id} error={Boolean(errors[group.id])} className="modifier-picker__group">
          <Header as="h5" className="modifier-picker__title">
            {group.name}
            <Label size="mini" basic>
              {choicesHint(group)}
            </Label>
          </Header>
          {group.modifiers.map((modifier) => (
            <Checkbox
              key={modifier.id}
              id={`modifier-option-${modifier.id}`}
              radio={group.max_choices === 1}
              className="modifier-picker__option"
              label={`${modifier.name} ${formatDelta(modifier.price_delta)}`.trim()}
              checked={value.includes(modifier.id)}
              onChange={() => onChange(toggleModifier(group, value, modifier.id))}
            />
          ))}
          {errors[group.id] && <div className="modifier-picker__error">{errors[group.id]}</div>}
        </Form.Field>
      ))}
    </div>
  );
}
