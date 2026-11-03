const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat('id-ID');

export function formatRupiah(value: number): string {
  return rupiahFormatter.format(value);
}

export function formatCompactRupiah(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(value);
}

export function formatNumber(value: number): string {
  return integerFormatter.format(value);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1).replace('.', ',')}%`;
}
