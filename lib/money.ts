// Shared money helpers.
//
// Amounts entered on the request forms are stored as display strings that
// carry thousands separators and sometimes a currency symbol (e.g. "3,434"
// or "$1,200.50"). Passing those straight to Number() yields NaN, which is
// how the dreaded "USD NaN" ends up on approval screens. parseAmount strips
// everything that isn't a digit, decimal point or minus sign first.

export function parseAmount(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Format an amount (string or number) as a currency string. Falls back to a
// plain "<currency> <number>" when the currency code isn't ISO-recognised
// (e.g. "ZWG"/"ZiG" which some runtimes reject).
export function formatAmount(value: unknown, currency = 'USD'): string {
  const n = parseAmount(value);
  try {
    return n.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 2 });
  } catch {
    return `${currency} ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}
