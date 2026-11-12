import React from "react";
import { barPercent } from "../../../utils/salesReports";

/** A value with a bar proportional to the largest one; the bar is decoration, the text is the data. */
export function BarCell({ value, max, children }) {
  return (
    <div className="report-bar">
      <div className="report-bar__fill" style={{ width: `${barPercent(value, max)}%` }} aria-hidden="true" />
      <span className="report-bar__text">{children}</span>
    </div>
  );
}
