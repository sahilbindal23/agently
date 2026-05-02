export function formatCurrency(cents = 0, currency = "inr") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0
  }).format(cents / 100);
}

export function formatNumber(value = 0) {
  return new Intl.NumberFormat("en-IN", { notation: "compact" }).format(value);
}

export function formatPercent(value = 0) {
  return `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}%`;
}
