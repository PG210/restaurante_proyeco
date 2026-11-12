import React from "react";
import { Form, Header, Message, Segment } from "semantic-ui-react";
import { BUSINESS_DAY_HINT, BUSINESS_DAY_WARNING, HOUR_OPTIONS } from "../../utils/reports";

export function BusinessDaySetting({ hour, savedHour, onChange }) {
  return (
    <Segment>
      <Header as="h3">Jornada</Header>
      <Form>
        <Form.Dropdown
          id="settings-business-day-start-hour"
          label="La jornada empieza a las"
          selection
          options={HOUR_OPTIONS}
          value={hour}
          onChange={(_, data) => onChange(data.value)}
        />
      </Form>
      <p className="settings-admin__hint">{BUSINESS_DAY_HINT}</p>
      {hour !== savedHour && <Message warning size="small" content={BUSINESS_DAY_WARNING} />}
    </Segment>
  );
}
