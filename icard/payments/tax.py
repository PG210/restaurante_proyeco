from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from payments.models import MONEY_DECIMAL_PLACES, ZERO

MONEY_QUANTUM = Decimal(10) ** -MONEY_DECIMAL_PLACES
PERCENT = Decimal(100)


@dataclass(frozen=True)
class TaxBreakdown:
    base: Decimal
    tax: Decimal


def to_money(value: Decimal | None) -> Decimal:
    return (value or ZERO).quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def split_included_tax(total: Decimal, rate: Decimal | None) -> TaxBreakdown:
    total = to_money(total)
    if not rate:
        return TaxBreakdown(base=total, tax=ZERO)
    base = to_money(total / (1 + rate / PERCENT))
    return TaxBreakdown(base=base, tax=total - base)
