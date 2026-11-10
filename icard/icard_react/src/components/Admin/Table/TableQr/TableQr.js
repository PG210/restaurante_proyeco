import React, { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button, Icon, Message } from "semantic-ui-react";
import "./TableQr.scss";
import { tableApi } from "../../../../api/table";
import { buildCustomerUrl } from "../../../../utils/customerPaths";
import { notifyError } from "../../../../utils/notify";

export const QR_SIZE = 240;
const PNG_MIME_TYPE = "image/png";

export function qrFileName(tableNumber) {
  return `mesa-${tableNumber}-qr.png`;
}

export function TableQr({ table, onRegenerated }) {
  const [currentTable, setCurrentTable] = useState(table);
  const [regenerating, setRegenerating] = useState(false);
  const canvasWrapper = useRef(null);

  const downloadPng = () => {
    const canvas = canvasWrapper.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL(PNG_MIME_TYPE);
    link.download = qrFileName(currentTable.number);
    link.click();
  };

  const regenerate = async () => {
    const confirmed = window.confirm(
      `¿Regenerar el código de la mesa ${currentTable.number}? El QR impreso actual dejará de funcionar.`,
    );
    if (!confirmed) return;
    setRegenerating(true);
    try {
      const updatedTable = await tableApi.regenerateToken(currentTable.id);
      setCurrentTable(updatedTable);
      onRegenerated();
    } catch (error) {
      notifyError(error);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="table-qr">
      {currentTable.token ? (
        <>
          <div ref={canvasWrapper} className="table-qr__code">
            <QRCodeCanvas value={buildCustomerUrl(currentTable.token)} size={QR_SIZE} includeMargin />
          </div>
          <p className="table-qr__url">{buildCustomerUrl(currentTable.token)}</p>
          <Button primary fluid onClick={downloadPng}>
            <Icon name="download" /> Descargar PNG
          </Button>
        </>
      ) : (
        <Message warning content="Esta mesa todavía no tiene código. Genéralo con el botón de abajo." />
      )}
      <Button basic negative fluid loading={regenerating} disabled={regenerating} onClick={regenerate}>
        <Icon name="refresh" /> {currentTable.token ? "Regenerar código" : "Generar código"}
      </Button>
    </div>
  );
}
