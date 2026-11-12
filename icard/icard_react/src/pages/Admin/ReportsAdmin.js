import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Form, Loader, Menu, Message } from "semantic-ui-react";
import { reportsApi } from "../../api/reports";
import {
  CancellationsReport,
  CategoriesReport,
  HeaderPage,
  HoursHeatmap,
  ProductsReport,
  StaffReport,
} from "../../components/Admin";
import { notifyError } from "../../utils/notify";
import { rangeError, rangeShortcuts } from "../../utils/reportRange";
import { CONSUMPTION_NOTE, DEFAULT_REPORT, REPORT_TABS, isReportKey, saveFile } from "../../utils/salesReports";

const REPORT_VIEWS = {
  products: ProductsReport,
  categories: CategoriesReport,
  hours: HoursHeatmap,
  staff: StaffReport,
  cancellations: CancellationsReport,
};

function readSelection(params) {
  const tab = params.get("tab");
  return {
    report: isReportKey(tab) ? tab : DEFAULT_REPORT,
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
}

/** The range to ask for: none means "the server's default" (the last 7 service days). */
function requestedRange({ from, to }) {
  return from && to ? { from, to } : {};
}

export function ReportsAdmin() {
  const [params, setParams] = useSearchParams();
  const selection = readSelection(params);
  const { report, from, to } = selection;
  const invalidRange = from || to ? rangeError(from, to) : null;
  const [draft, setDraft] = useState({ from, to });
  const [loaded, setLoaded] = useState(null);
  const [today, setToday] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (invalidRange) return undefined;
    let active = true;
    setLoaded(null);
    reportsApi
      .sales(report, requestedRange({ from, to }))
      .then((data) => {
        if (!active) return;
        setLoaded({ report, data });
        setToday(data.range.today);
        setDraft((current) => (current.from && current.to ? current : { from: data.range.first, to: data.range.last }));
      })
      .catch((error) => active && notifyError(error));
    return () => {
      active = false;
    };
  }, [report, from, to, invalidRange]);

  const select = (changes) => setParams({ ...Object.fromEntries(params), ...changes });

  const changeDate = (name, value) => {
    const next = { ...draft, [name]: value };
    setDraft(next);
    if (!rangeError(next.from, next.to)) select(next);
  };

  const applyShortcut = (shortcut) => {
    setDraft({ from: shortcut.from, to: shortcut.to });
    select({ from: shortcut.from, to: shortcut.to });
  };

  const download = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await reportsApi.downloadSales(report, requestedRange({ from, to }));
      saveFile(blob, filename);
    } catch (error) {
      notifyError(error);
    } finally {
      setDownloading(false);
    }
  };

  const data = loaded?.report === report ? loaded.data : null;
  const draftError = draft.from && draft.to ? rangeError(draft.from, draft.to) : null;

  return (
    <>
      <HeaderPage title="Reportes" />
      <Form as="div" className="reports-admin__filters">
        <Form.Input id="reports-from" label="Desde" type="date" value={draft.from} onChange={(_, { value }) => changeDate("from", value)} />
        <Form.Input id="reports-to" label="Hasta" type="date" value={draft.to} onChange={(_, { value }) => changeDate("to", value)} />
        {today && (
          <Button.Group basic size="small">
            {rangeShortcuts(today).map((shortcut) => (
              <Button key={shortcut.key} type="button" onClick={() => applyShortcut(shortcut)}>
                {shortcut.label}
              </Button>
            ))}
          </Button.Group>
        )}
        <Button
          type="button"
          icon="download"
          content="Descargar CSV"
          onClick={download}
          loading={downloading}
          disabled={downloading || Boolean(invalidRange)}
        />
      </Form>
      {(draftError || invalidRange) && <Message warning content={draftError || invalidRange} />}
      <p className="report-note">{CONSUMPTION_NOTE}</p>

      <Menu pointing secondary stackable aria-label="Reportes">
        {REPORT_TABS.map((tab) => (
          <Menu.Item
            key={tab.key}
            as="button"
            type="button"
            name={tab.label}
            active={tab.key === report}
            aria-pressed={tab.key === report}
            onClick={() => select({ tab: tab.key })}
          />
        ))}
      </Menu>
      <ReportBody report={report} data={data} blocked={Boolean(invalidRange)} />
    </>
  );
}

function ReportBody({ report, data, blocked }) {
  if (blocked) return null;
  if (data === null) {
    return (
      <Loader active inline="centered">
        Cargando...
      </Loader>
    );
  }
  const View = REPORT_VIEWS[report];
  return (
    <section aria-label={REPORT_TABS.find((tab) => tab.key === report).label}>
      <View data={data} />
    </section>
  );
}
