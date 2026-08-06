export function formatCurrency(value: number | string | null | undefined, currency = "NGN") {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

/**
 * Splits a formatted currency amount into its currency symbol and numeric
 * body (e.g. "₦" + "101.53"), so callers that want a visually de-emphasized
 * symbol (smaller/lighter) next to a larger amount — e.g. the dashboard's
 * wallet balance card — can style each part independently instead of
 * treating the whole string as one opaque unit.
 */
export function splitCurrencyParts(value: number | string | null | undefined, currency = "NGN") {
  const numeric = Number(value ?? 0);
  const parts = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(Number.isFinite(numeric) ? numeric : 0);

  const symbol = parts.find((part) => part.type === "currency")?.value ?? "";
  const amount = parts
    .filter((part) => part.type !== "currency")
    .map((part) => part.value)
    .join("");

  return { symbol, amount };
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
