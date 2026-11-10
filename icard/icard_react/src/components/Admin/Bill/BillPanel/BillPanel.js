import React from "react";
import { Link } from "react-router-dom";
import { Button, Header, Icon, Message, Segment, Statistic } from "semantic-ui-react";
import "./BillPanel.scss";
import { billTicketPath } from "../../../../utils/adminSections";
import { canChargeBill, isPrepaidBill, unpaidLines } from "../../../../utils/bill";
import { formatMoney } from "../../../../utils/money";
import { BILL_STATUS } from "../../../../utils/paymentMethods";
import { PERMISSIONS, hasAnyPermission, hasPermission } from "../../../../utils/permissions";
import { taxLabel } from "../../../../utils/tax";
import { PaymentList } from "../PaymentList/PaymentList";

export function billStatistics(bill) {
  const statistics = [
    { key: "subtotal", label: "Total", value: bill.totals.subtotal },
    { key: "paid", label: "Pagado", value: bill.totals.paid },
    { key: "tips", label: "Propinas", value: bill.totals.tips },
    { key: "balance", label: "Saldo", value: bill.totals.balance, color: "red" },
  ];
  if (!bill.tax_type) return statistics;
  return [
    { key: "base", label: "Base", value: bill.totals.tax_base },
    { key: "tax", label: taxLabel(bill.tax_type, bill.tax_rate), value: bill.totals.tax },
    ...statistics,
  ];
}

export function BillPanel({ bill, paidBillId, user, onCharge, onReverse }) {
  if (!bill) return <PaidOrEmpty paidBillId={paidBillId} user={user} />;

  const isOpen = bill.status === BILL_STATUS.OPEN;
  const prepaid = isPrepaidBill(bill);
  const canCharge = isOpen && hasPermission(user, PERMISSIONS.CHARGE_BILL) && canChargeBill(bill);
  const statistics = billStatistics(bill);

  return (
    <Segment className="bill-panel">
      <div className="bill-panel__header">
        <Header as="h3">Cuenta {prepaid ? "(cobro anticipado)" : ""}</Header>
        {canCharge && (
          <Button primary onClick={onCharge}>
            <Icon name="money" /> {prepaid ? "Cobrar pedidos" : "Cobrar"}
          </Button>
        )}
      </div>

      <Statistic.Group size="mini" widths={statistics.length}>
        {statistics.map((statistic) => (
          <Statistic key={statistic.key} color={statistic.color} label={statistic.label} value={formatMoney(statistic.value)} />
        ))}
      </Statistic.Group>

      {prepaid && unpaidLines(bill).length > 0 && (
        <Message warning size="small" content="Hay pedidos por cobrar. La cocina no los verá hasta que se cobren." />
      )}
      {bill.orders_in_progress && (
        <Message
          warning
          size="small"
          content="Hay pedidos sin entregar. La cuenta no se puede cerrar hasta entregarlos o cancelarlos."
        />
      )}

      <PaymentList payments={bill.payments} billIsOpen={isOpen} isStaff={Boolean(user?.is_staff)} onReverse={onReverse} />
    </Segment>
  );
}

function PaidOrEmpty({ paidBillId, user }) {
  if (!paidBillId) return null;
  const canSeeTicket = hasAnyPermission(user, [PERMISSIONS.CHARGE_BILL, PERMISSIONS.VIEW_PAYMENTS]);

  return (
    <Message positive>
      <Message.Header>Cuenta pagada</Message.Header>
      <p>La mesa quedó cerrada y lista para los próximos clientes.</p>
      {canSeeTicket && (
        <Button as={Link} to={billTicketPath(paidBillId)} size="small">
          <Icon name="print" /> Ver ticket
        </Button>
      )}
    </Message>
  );
}
