/**
 * Currencies organizations can post pay in — the opportunity's country's own
 * currency, per product requirement that "all opportunities carry expected
 * pay in the respective country's currency". African currencies first (NGN
 * default, matching the platform's primary audience), then major globals
 * for remote/international postings.
 */
export const PAY_CURRENCIES: { code: string; label: string }[] = [
  { code: "NGN", label: "NGN — Nigerian Naira" },
  { code: "GHS", label: "GHS — Ghanaian Cedi" },
  { code: "KES", label: "KES — Kenyan Shilling" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "EGP", label: "EGP — Egyptian Pound" },
  { code: "TZS", label: "TZS — Tanzanian Shilling" },
  { code: "UGX", label: "UGX — Ugandan Shilling" },
  { code: "RWF", label: "RWF — Rwandan Franc" },
  { code: "XOF", label: "XOF — West African CFA Franc" },
  { code: "XAF", label: "XAF — Central African CFA Franc" },
  { code: "ETB", label: "ETB — Ethiopian Birr" },
  { code: "MAD", label: "MAD — Moroccan Dirham" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
];

export const PAY_PERIODS: { value: string; label: string }[] = [
  { value: "hour", label: "per hour" },
  { value: "day", label: "per day" },
  { value: "week", label: "per week" },
  { value: "month", label: "per month" },
  { value: "year", label: "per year" },
  { value: "project", label: "per project" },
];

/** "₦250,000 per month" — falls back to a plain code prefix for currencies Intl doesn't know. */
export function formatPay(amount: number | null | undefined, currency: string | null | undefined, period: string | null | undefined): string | null {
  if (amount == null || !currency) return null;
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount);
  } catch {
    formatted = `${currency} ${amount.toLocaleString("en")}`;
  }
  const periodLabel = PAY_PERIODS.find((p) => p.value === period)?.label;
  return periodLabel ? `${formatted} ${periodLabel}` : formatted;
}
