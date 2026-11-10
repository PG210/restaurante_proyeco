import React, { useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Button, Icon, Loader, Message } from "semantic-ui-react";
import "./TablesQrPrint.scss";
import { useTable } from "../../hooks";
import { ADMIN_SECTIONS } from "../../utils/adminSections";
import { buildCustomerUrl } from "../../utils/customerPaths";
import { notifyError } from "../../utils/notify";

const PRINT_QR_SIZE = 180;

export function TablesQrPrint() {
  const { tables, getTables } = useTable();

  const loadTables = useCallback(() => getTables().catch(notifyError), [getTables]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  if (tables === null) {
    return (
      <Loader active inline="centered">
        Cargando...
      </Loader>
    );
  }

  const tablesWithToken = tables.filter((table) => table.token);
  const tablesWithoutToken = tables.length - tablesWithToken.length;

  return (
    <div className="tables-qr-print">
      <div className="tables-qr-print__toolbar">
        <Button as={Link} to={ADMIN_SECTIONS.tables.path} basic>
          <Icon name="arrow left" /> Volver a mesas
        </Button>
        <Button primary onClick={() => window.print()}>
          <Icon name="print" /> Imprimir
        </Button>
      </div>

      {tablesWithoutToken > 0 && (
        <Message
          warning
          className="tables-qr-print__toolbar"
          content={`${tablesWithoutToken} mesa(s) sin código. Genera su código desde Mesas → QR.`}
        />
      )}

      <div className="tables-qr-print__grid">
        {tablesWithToken.map((table) => (
          <div key={table.id} className="tables-qr-print__card">
            <QRCodeSVG value={buildCustomerUrl(table.token)} size={PRINT_QR_SIZE} includeMargin />
            <strong>Mesa {table.number}</strong>
            <span>Escanea para ver la carta y pedir</span>
          </div>
        ))}
      </div>
    </div>
  );
}
