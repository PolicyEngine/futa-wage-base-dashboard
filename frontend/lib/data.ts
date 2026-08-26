/**
 * Precomputed FUTA wage base reform estimates.
 *
 * Reform: raise the FUTA taxable wage base from $7,000 to $43,000 in 2026,
 * index to the CPI-U thereafter (prior-February index sets the year's base,
 * rounded to the nearest $100), holding the 6.0% rate and maximum 5.4%
 * credit (0.6% net) constant.
 *
 * Computed with policyengine-us 1.808.0 on the Microcosm US 2024 national
 * dataset (Build P sparse release
 * populace-us-2024-buildp-sparse-rmloss100-cae8640, 2026-07-28).
 * Revenue basis: 0.6% net rate for all employers.
 */

export interface YearResult {
  year: number;
  /** FUTA taxable wage base under the reform ($). */
  wageBase: number;
  /** CPI-U index value (prior February) used to set the base. */
  cpiU: number;
  /** Baseline FUTA revenue at the $7,000 base ($). */
  baseline: number;
  /** FUTA revenue under the reform ($). */
  reform: number;
  /** Additional revenue raised by the reform ($). */
  additional: number;
  /** Workers with wages above the current $7,000 base. */
  workersAbove7k: number;
}

export const RESULTS: YearResult[] = [
  { year: 2026, wageBase: 43000, cpiU: 319.8, baseline: 6820184824, reform: 33265912046, additional: 26445727221, workersAbove7k: 155678430 },
  { year: 2027, wageBase: 44000, cpiU: 327.5, baseline: 6870789894, reform: 34427123058, additional: 27556333164, workersAbove7k: 156758509 },
  { year: 2028, wageBase: 45800, cpiU: 340.3, baseline: 6913470019, reform: 36006176179, additional: 29092706160, workersAbove7k: 158827065 },
  { year: 2029, wageBase: 46800, cpiU: 348.3, baseline: 6949815159, reform: 37129665273, additional: 30179850115, workersAbove7k: 159594582 },
  { year: 2030, wageBase: 47900, cpiU: 356.3, baseline: 6984905250, reform: 38312896152, additional: 31327990903, workersAbove7k: 160354074 },
  { year: 2031, wageBase: 49000, cpiU: 364.3, baseline: 7018646643, reform: 39501606909, additional: 32482960266, workersAbove7k: 160989647 },
  { year: 2032, wageBase: 50100, cpiU: 372.6, baseline: 7050868169, reform: 40690711056, additional: 33639842887, workersAbove7k: 161724825 },
  { year: 2033, wageBase: 51200, cpiU: 381.0, baseline: 7080321729, reform: 41882736997, additional: 34802415269, workersAbove7k: 163726871 },
  { year: 2034, wageBase: 52400, cpiU: 389.6, baseline: 7107725250, reform: 43145416070, additional: 36037690820, workersAbove7k: 164470269 },
  { year: 2035, wageBase: 53600, cpiU: 398.4, baseline: 7133790606, reform: 44414103587, additional: 37280312981, workersAbove7k: 165003667 },
];

export const TEN_YEAR_TOTAL = RESULTS.reduce((sum, r) => sum + r.additional, 0);

export const MODEL_INFO = {
  policyengineUs: '1.808.0',
  dataset:
    'Microcosm US 2024 national dataset (formerly Populace), Build P sparse release',
  datasetRelease: 'populace-us-2024-buildp-sparse-rmloss100-cae8640-20260728T011454Z',
};

export interface ValidationYear {
  /** Federal fiscal year of the IRS figure. */
  fiscalYear: number;
  /** Actual FUTA gross collections, IRS Data Book Table 1 ($). */
  irsActual: number;
  /**
   * Model baseline for the matching calendar year with actual statutory
   * credit-reduction rates applied ($).
   */
  modelStatutory: number;
}

/**
 * Actual FUTA collections (IRS Data Book Table 1, "Unemployment insurance"
 * gross collections line) vs. the model baseline run with the statutory
 * credit-reduction rates in effect each year. IRS figures are fiscal-year
 * cash collections and include penalties and interest; model figures are
 * calendar-year accrued liability.
 */
export const VALIDATION: ValidationYear[] = [
  { fiscalYear: 2024, irsActual: 8130484000, modelStatutory: 8417777224 },
  { fiscalYear: 2025, irsActual: 8776869000, modelStatutory: 8341294315 },
];

export function buildCsv(): string {
  const header =
    'year,taxable_wage_base_usd,cpi_u_index,baseline_revenue_usd,reform_revenue_usd,additional_revenue_usd,workers_above_7000';
  const rows = RESULTS.map(
    (r) =>
      `${r.year},${r.wageBase},${r.cpiU.toFixed(1)},${r.baseline},${r.reform},${r.additional},${r.workersAbove7k}`,
  );
  return [header, ...rows].join('\n') + '\n';
}
