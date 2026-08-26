/** Formatowanie pod polskiego odbiorcę: przecinek dziesiętny, spacja jako separator tysięcy. */

const LOCALE = 'pl-PL';

export function formatCurrency(value: number, currency = 'PLN'): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatPercent(value: number, fractionDigits = 2): string {
  return `${formatNumber(value, fractionDigits)}%`;
}

/** Wartość opcjonalna — kreska zamiast "null" albo mylącego zera. */
export function formatOptional(
  value: number | null,
  formatter: (v: number) => string,
): string {
  return value === null ? '—' : formatter(value);
}

/** Zmiana procentowa ze znakiem, do oznaczania trendu. */
export function formatChange(value: number | null): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, 1)}%`;
}
