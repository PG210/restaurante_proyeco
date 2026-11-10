const PERCENT = 100;

export const TAX_TYPE = {
  INC: "INC",
  IVA: "IVA",
};

export const PAYMENT_MODE = {
  POSTPAID: "POSTPAID",
  PREPAID: "PREPAID",
};

export const PAYMENT_MODE_LABELS = {
  [PAYMENT_MODE.POSTPAID]: "Al final",
  [PAYMENT_MODE.PREPAID]: "Anticipado",
};

export function splitIncludedTaxCents(totalCents, rate) {
  const numericRate = Number(rate);
  if (!numericRate) return { baseCents: totalCents, taxCents: 0 };
  const baseCents = Math.round(totalCents / (1 + numericRate / PERCENT));
  return { baseCents, taxCents: totalCents - baseCents };
}

export function formatRate(rate) {
  return `${Number(rate).toLocaleString("es", { maximumFractionDigits: 2 })} %`;
}

export function taxLabel(taxType, rate) {
  return taxType ? `${taxType} ${formatRate(rate)}` : "";
}
