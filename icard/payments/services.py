import logging
from dataclasses import dataclass, field
from decimal import Decimal

from django.db import transaction
from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.utils import timezone

from configuration.models import PaymentMode
from configuration.services import get_settings
from orders.models import KITCHEN_STATUSES, OrderStatus
from payments.models import Bill, BillStatus, Payment
from payments.tax import split_included_tax, to_money
from tables.models import Table
from tables.services import close_table
from users.models import User

logger = logging.getLogger(__name__)

LINE_TOTAL = ExpressionWrapper(F('price') * F('quantity'), output_field=DecimalField())


class BillError(Exception):
    pass


class BillClosedError(BillError):
    pass


class OverpaymentError(BillError):
    pass


class OrdersInProgressError(BillError):
    pass


class MissingPriceError(BillError):
    pass


class PaymentReversalError(BillError):
    pass


class TableHasOpenBillError(BillError):
    pass


class PrepaidChargeError(BillError):
    pass


@dataclass(frozen=True)
class BillTotals:
    subtotal: Decimal
    paid: Decimal
    tips: Decimal
    tax_base: Decimal
    tax: Decimal

    @property
    def balance(self) -> Decimal:
        return self.subtotal - self.paid


@dataclass(frozen=True)
class ChargeRequest:
    method: str
    amount: Decimal
    tip: Decimal
    reference: str
    order_ids: tuple[int, ...] = field(default_factory=tuple)


def get_or_create_open_bill(table: Table) -> Bill:
    locked_table = Table.objects.select_for_update().get(pk=table.pk)
    open_bill = Bill.objects.select_for_update().filter(table=locked_table, status=BillStatus.OPEN).first()
    return open_bill or _open_bill(locked_table)


def _open_bill(table: Table) -> Bill:
    restaurant_settings = get_settings()
    active_tax = restaurant_settings.active_tax()
    tax_type, tax_rate = active_tax if active_tax else ('', None)
    return Bill.objects.create(
        table=table,
        table_number=table.number,
        payment_mode=restaurant_settings.payment_mode,
        tax_type=tax_type,
        tax_rate=tax_rate,
    )


def initial_order_status(bill: Bill) -> str:
    if bill.payment_mode == PaymentMode.PREPAID:
        return OrderStatus.AWAITING_PAYMENT
    return OrderStatus.PENDING


def get_open_bill(table: Table) -> Bill | None:
    return Bill.objects.filter(table=table, status=BillStatus.OPEN).first()


def bill_totals(bill: Bill) -> BillTotals:
    if bill.status == BillStatus.PAID:
        return _paid_bill_totals(bill)
    subtotal = to_money(
        bill.orders.exclude(status=OrderStatus.CANCELLED).aggregate(total=Sum(LINE_TOTAL))['total']
    )
    payments = bill.payments.aggregate(paid=Sum('amount'), tips=Sum('tip'))
    breakdown = split_included_tax(subtotal, bill.tax_rate)
    return BillTotals(
        subtotal=subtotal,
        paid=to_money(payments['paid']),
        tips=to_money(payments['tips']),
        tax_base=breakdown.base,
        tax=breakdown.tax,
    )


def _paid_bill_totals(bill: Bill) -> BillTotals:
    breakdown = split_included_tax(bill.subtotal, bill.tax_rate)
    return BillTotals(
        subtotal=bill.subtotal,
        paid=bill.total_paid,
        tips=bill.tip_total,
        tax_base=bill.tax_base if bill.tax_base is not None else breakdown.base,
        tax=bill.tax_amount if bill.tax_amount is not None else breakdown.tax,
    )


def has_orders_in_progress(bill: Bill) -> bool:
    return bill.orders.filter(status__in=KITCHEN_STATUSES).exists()


def has_unpaid_orders(bill: Bill) -> bool:
    return bill.orders.filter(status=OrderStatus.AWAITING_PAYMENT).exists()


def charge(bill: Bill, request: ChargeRequest, user: User) -> Bill:
    with transaction.atomic():
        locked_bill = _lock_bill(bill)
        _ensure_open(locked_bill)
        _ensure_priced(locked_bill)
        if locked_bill.payment_mode == PaymentMode.PREPAID:
            _charge_prepaid(locked_bill, request, user)
        else:
            _charge_postpaid(locked_bill, request, user)
        return locked_bill


def _charge_postpaid(bill: Bill, request: ChargeRequest, user: User) -> None:
    if request.order_ids:
        raise PrepaidChargeError('En cobro al final no se eligen pedidos: se cobra la cuenta.')
    balance = bill_totals(bill).balance
    if request.amount > balance:
        raise OverpaymentError(f'El monto supera el saldo pendiente ({balance}).')
    settles_bill = request.amount == balance
    if settles_bill and has_orders_in_progress(bill):
        raise OrdersInProgressError(
            'Hay pedidos sin entregar. Entrégalos o cancélalos antes de cerrar la cuenta.'
        )
    _record_payment(bill, request, user)
    if settles_bill:
        _close_bill(bill, user)


def _charge_prepaid(bill: Bill, request: ChargeRequest, user: User) -> None:
    if not request.order_ids:
        raise PrepaidChargeError('En cobro anticipado hay que elegir los pedidos que se cobran.')
    orders = bill.orders.select_for_update().filter(
        pk__in=request.order_ids, status=OrderStatus.AWAITING_PAYMENT, payment__isnull=True
    )
    if orders.count() != len(set(request.order_ids)):
        raise PrepaidChargeError('Algún pedido ya está pagado, fue cancelado o no pertenece a esta cuenta.')
    expected = to_money(orders.aggregate(total=Sum(LINE_TOTAL))['total'])
    if request.amount != expected:
        raise PrepaidChargeError(
            f'El monto debe ser exactamente el total de los pedidos elegidos ({expected}).'
        )
    payment = _record_payment(bill, request, user)
    orders.update(status=OrderStatus.PENDING, payment=payment, updated_at=timezone.now())


def _record_payment(bill: Bill, request: ChargeRequest, user: User) -> Payment:
    payment = Payment.objects.create(
        bill=bill,
        method=request.method,
        amount=request.amount,
        tip=request.tip,
        reference=request.reference,
        created_by=user,
    )
    logger.info(
        'Pago %s registrado en la cuenta %s (mesa %s): %s %s, propina %s.',
        payment.pk,
        bill.pk,
        bill.table_number,
        request.method,
        request.amount,
        request.tip,
    )
    return payment


def reverse_payment(payment: Payment, reason: str, user: User) -> Payment:
    with transaction.atomic():
        locked_bill = _lock_bill(payment.bill)
        _ensure_open(locked_bill)
        original = Payment.objects.select_for_update().get(pk=payment.pk)
        if original.reverses_id is not None:
            raise PaymentReversalError('Una anulación no se puede anular.')
        if Payment.objects.filter(reverses=original).exists():
            raise PaymentReversalError('Este pago ya fue anulado.')
        _release_prepaid_orders(original)
        reversal = Payment.objects.create(
            bill=locked_bill,
            method=original.method,
            amount=-original.amount,
            tip=-original.tip,
            reverses=original,
            reason=reason,
            created_by=user,
        )
        logger.info(
            'Pago %s anulado por el pago %s en la cuenta %s.', original.pk, reversal.pk, locked_bill.pk
        )
        return reversal


def _release_prepaid_orders(payment: Payment) -> None:
    covered_orders = payment.covered_orders.select_for_update()
    if covered_orders.exclude(status=OrderStatus.PENDING).exists():
        raise PaymentReversalError('La cocina ya empezó algún pedido de este cobro; no se puede anular.')
    covered_orders.update(status=OrderStatus.AWAITING_PAYMENT, payment=None, updated_at=timezone.now())


def close_table_checking_bill(table: Table, user: User) -> Table:
    with transaction.atomic():
        locked_table = Table.objects.select_for_update().get(pk=table.pk)
        open_bill = (
            Bill.objects.select_for_update().filter(table=locked_table, status=BillStatus.OPEN).first()
        )
        if open_bill is not None:
            _settle_before_closing(open_bill, user)
        locked_table.refresh_from_db()
        return close_table(locked_table)


def _settle_before_closing(bill: Bill, user: User) -> None:
    if has_unpaid_orders(bill):
        raise TableHasOpenBillError('Hay pedidos sin cobrar. Cóbralos o cancélalos antes de cerrar la mesa.')
    if has_orders_in_progress(bill):
        raise TableHasOpenBillError(
            'Hay pedidos sin entregar. Entrégalos o cancélalos antes de cerrar la mesa.'
        )
    totals = bill_totals(bill)
    if totals.balance:
        raise TableHasOpenBillError('La mesa tiene una cuenta pendiente. Cóbrala antes de cerrar la mesa.')
    if totals.subtotal or totals.paid:
        _close_bill(bill, user)
        return
    bill.orders.update(close=True, bill=None)
    bill.delete()


def _lock_table(table_id: int) -> Table | None:
    return Table.objects.select_for_update().filter(pk=table_id).first()


def _lock_bill(bill: Bill) -> Bill:
    if bill.table_id is not None:
        _lock_table(bill.table_id)
    return Bill.objects.select_for_update().get(pk=bill.pk)


def _ensure_open(bill: Bill) -> None:
    if bill.status != BillStatus.OPEN:
        raise BillClosedError('La cuenta ya está pagada.')


def _ensure_priced(bill: Bill) -> None:
    unpriced = bill.orders.exclude(status=OrderStatus.CANCELLED).filter(price__isnull=True).exists()
    if unpriced:
        raise MissingPriceError(
            'Hay pedidos sin precio. Ejecuta "manage.py backfill_order_prices" antes de cobrar.'
        )


def _close_bill(bill: Bill, user: User) -> None:
    totals = bill_totals(bill)
    bill.status = BillStatus.PAID
    bill.closed_at = timezone.now()
    bill.closed_by = user
    bill.subtotal = totals.subtotal
    bill.tip_total = totals.tips
    bill.total_paid = totals.paid
    bill.tax_base = totals.tax_base
    bill.tax_amount = totals.tax
    bill.save(
        update_fields=[
            'status',
            'closed_at',
            'closed_by',
            'subtotal',
            'tip_total',
            'total_paid',
            'tax_base',
            'tax_amount',
        ]
    )
    bill.orders.update(close=True)
    if bill.table_id is not None:
        close_table(Table.objects.get(pk=bill.table_id))
    logger.info('Cuenta %s (mesa %s) cerrada.', bill.pk, bill.table_number)
