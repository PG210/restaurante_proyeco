import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Icon, Loader, Message } from "semantic-ui-react";
import "./BillTicket.scss";
import { billApi } from "../../api/bill";
import { formatDateTime } from "../../utils/dateRange";
import { formatMoney } from "../../utils/money";
import { notifyError } from "../../utils/notify";
import { ORDER_STATUS } from "../../utils/orderStatus";
import { BILL_STATUS } from "../../utils/paymentMethods";
import { taxLabel } from "../../utils/tax";

export function billableLines(lines) {
  return lines.filter((line) => line.status !== ORDER_STATUS.CANCELLED);
}

export function BillTicket() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    billApi
      .retrieve(id)
      .then(setBill)
      .catch((error) => {
        notifyError(error);
        setFailed(true);
      });
  }, [id]);

  if (failed) return <Message negative content="No se pudo cargar el ticket." />;
  if (!bill) {
    return (
      <Loader active inline="centered">
        Cargando ticket...
      </Loader>
    );
  }

  return (
    <div className="bill-ticket">
      <div className="bill-ticket__toolbar">
        <Button basic onClick={() => navigate(-1)}>
          <Icon name="arrow left" /> Volver
        </Button>
        <Button primary onClick={() => window.print()}>
          <Icon name="print" /> Imprimir
        </Button>
      </div>

      <div className="bill-ticket__paper">
        <h2>iCard</h2>
        <p>
          Mesa {bill.table_number} · Cuenta #{bill.id}
        </p>
        <p>{formatDateTime(bill.closed_at ?? bill.opened_at)}</p>
        {bill.status === BILL_STATUS.OPEN && <p className="bill-ticket__draft">CUENTA ABIERTA — NO VÁLIDO COMO COMPROBANTE</p>}

        <table>
          <tbody>
            {billableLines(bill.lines).map((line) => (
              <tr key={line.id}>
                <td>
                  {line.quantity} × {line.product_title}
                  <small>{formatMoney(line.price)} c/u</small>
                </td>
                <td>{formatMoney(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl>
          {bill.tax_type && (
            <>
              <dt>Base</dt>
              <dd>{formatMoney(bill.totals.tax_base)}</dd>
              <dt>{taxLabel(bill.tax_type, bill.tax_rate)}</dt>
              <dd>{formatMoney(bill.totals.tax)}</dd>
            </>
          )}
          <dt>Total consumo</dt>
          <dd>{formatMoney(bill.totals.subtotal)}</dd>
          <dt>Propina</dt>
          <dd>{formatMoney(bill.totals.tips)}</dd>
          <dt className="bill-ticket__total">Total pagado</dt>
          <dd className="bill-ticket__total">{formatMoney(bill.totals.paid)}</dd>
        </dl>

        <h4>Pagos</h4>
        {bill.payments.map((payment) => (
          <p key={payment.id}>
            {payment.method_label} {formatMoney(payment.amount)}
            {payment.reverses ? " (anulación)" : ""}
          </p>
        ))}
        {bill.closed_by_name && <p>Atendido por {bill.closed_by_name}</p>}
        <p className="bill-ticket__thanks">¡Gracias por tu visita!</p>
        <p className="bill-ticket__legal">Documento no válido como factura.</p>
      </div>
    </div>
  );
}
