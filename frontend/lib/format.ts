/** Number formatting shared by the page, the footer, and the tests. */

export const formatBillions = (value: number) => `$${(value / 1e9).toFixed(1)}B`;

export const formatBillionsLong = (value: number) => `$${(value / 1e9).toFixed(1)} billion`;

export const formatDollars = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

export const formatMillions = (value: number) => `${(value / 1e6).toFixed(1)} million`;

export const formatMillionDollars = (value: number) => `$${Math.round(value / 1e6)} million`;

/** "2026-06-01" or "2026-06" to "June 2026". */
export const formatMonth = (isoDate: string) => {
  const [year, month] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export const formatPercent = (value: number, digits = 1) =>
  `${(value * 100).toFixed(digits)}%`;

/** Signed percentage with a true minus sign, e.g. "+3.5%" or "−3.2%". */
export const formatSignedPercent = (value: number, digits = 1) => {
  const pct = Math.abs(value * 100).toFixed(digits);
  if (Number(pct) === 0) return `${pct}%`;
  return `${value > 0 ? '+' : '−'}${pct}%`;
};
