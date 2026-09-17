/**
 * Dashboard data, read from the analysis output.
 *
 * `results.json` is written by analysis/futa_wage_base.py alongside
 * analysis/futa_results.json; a test asserts the two files are identical, so
 * every number on the page traces to one model run. Nothing in this module
 * is hand-typed except the source citations for the IRS figures.
 */

import raw from './results.json';
import rawAdjustments from './adjustments.json';

type RawRow = {
  year: number;
  weighted_persons: number;
  baseline_revenue_flat_06: number;
  workers_with_wages: number;
  workers_above_current_base: number;
  baseline_revenue_statutory?: number;
  model_futa_variable_check?: number;
  credit_reduction_surcharge?: number;
  wage_base?: number;
  cpi_u_prior_year_average?: number;
  cpi_u_source?: string;
  reform_revenue_flat_06?: number;
  additional_revenue_flat_06?: number;
};

type RawValidation = {
  fiscal_year: number;
  irs_gross_collections: number;
  irs_refunds: number;
  model_fiscal_year_basis: number;
  model_flat_06_calendar_year: number;
  model_surcharge_prior_calendar_year: number;
  model_surcharge_prior_calendar_year_basis: string;
  model_statutory_same_calendar_year: number | null;
};

type RawOutput = {
  generated: string;
  policyengine_version: string;
  policyengine_us_version: string;
  bundle: Record<string, unknown>;
  cpi_u_reference: {
    calendar_year: number;
    average: number;
    source: string;
    last_observed_month: string;
  };
  results: RawRow[];
  surcharge_approximations: Record<
    string,
    { year: number; credit_reduction_surcharge: number; basis: string; states_with_rates: string[] }
  >;
  validation: RawValidation[];
};

const data = raw as RawOutput;

export const CURRENT_BASE = 7_000;
export const NET_RATE = 0.006;

export interface YearResult {
  /** Calendar (tax) year. */
  year: number;
  /** FUTA taxable wage base under the reform ($). */
  wageBase: number;
  /** CPI-U calendar-year average for the prior year that set this base. */
  cpiUPriorYearAverage: number;
  /** Where that CPI-U value came from (BLS observed, CBO projection, or a mix). */
  cpiUSource: string;
  /** FUTA revenue at the $7,000 base, flat 0.6% net rate ($). */
  baseline: number;
  /** FUTA revenue under the reform, flat 0.6% net rate ($). */
  reform: number;
  /** Additional revenue raised by the reform ($). */
  additional: number;
  /** People with any modeled wages in the year. */
  workersWithWages: number;
  /** People with modeled wages above the current $7,000 base. */
  workersAbove7k: number;
}

export const RESULTS: YearResult[] = data.results
  .filter((r) => r.wage_base !== undefined)
  .map((r) => ({
    year: r.year,
    wageBase: r.wage_base as number,
    cpiUPriorYearAverage: r.cpi_u_prior_year_average as number,
    cpiUSource: r.cpi_u_source as string,
    baseline: r.baseline_revenue_flat_06,
    reform: r.reform_revenue_flat_06 as number,
    additional: r.additional_revenue_flat_06 as number,
    workersWithWages: r.workers_with_wages,
    workersAbove7k: r.workers_above_current_base,
  }));

export const FIRST = RESULTS[0];
export const LAST = RESULTS[RESULTS.length - 1];
export const TEN_YEAR_TOTAL = RESULTS.reduce((sum, r) => sum + r.additional, 0);

/** Model credit-reduction surcharge (statutory minus flat) by calendar year. */
export const SURCHARGES: Record<number, number> = Object.fromEntries(
  data.results
    .filter((r) => r.credit_reduction_surcharge !== undefined)
    .map((r) => [r.year, r.credit_reduction_surcharge as number]),
);

export interface ValidationYear {
  /** Federal fiscal year (October to September) of the IRS figure. */
  fiscalYear: number;
  /** IRS Data Book gross collections, unemployment insurance line ($). */
  irsGross: number;
  /** IRS refunds on that line ($); net collections = gross minus refunds. */
  irsRefunds: number;
  /** Model on a fiscal-year basis: flat 0.6% for the year plus the prior year's surcharge ($). */
  modelFiscalYear: number;
  /** Flat 0.6% model revenue for the same calendar year ($). */
  modelFlatCalendarYear: number;
  /** Model surcharge for the prior calendar year ($). */
  modelSurchargePriorYear: number;
  /** True when the prior year was simulated; false when its surcharge was approximated. */
  priorYearModeled: boolean;
}

export const VALIDATION: ValidationYear[] = data.validation.map((v) => ({
  fiscalYear: v.fiscal_year,
  irsGross: v.irs_gross_collections,
  irsRefunds: v.irs_refunds,
  modelFiscalYear: v.model_fiscal_year_basis,
  modelFlatCalendarYear: v.model_flat_06_calendar_year,
  modelSurchargePriorYear: v.model_surcharge_prior_calendar_year,
  priorYearModeled: v.model_surcharge_prior_calendar_year_basis === 'modeled',
}));

/** Approximated surcharges for years the dataset cannot simulate (keyed by year). */
export const SURCHARGE_APPROXIMATIONS = data.surcharge_approximations ?? {};

const bundleString = (key: string): string | undefined => {
  const v = data.bundle?.[key];
  return typeof v === 'string' ? v : undefined;
};

export const MODEL_INFO = {
  policyengine: data.policyengine_version,
  policyengineUs: data.policyengine_us_version,
  datasetBuild:
    bundleString('certified_data_build_id') ??
    bundleString('data_build_id') ??
    bundleString('build_id') ??
    'see analysis/futa_results.json',
  datasetUri: bundleString('runtime_dataset_uri') ?? bundleString('default_dataset_uri'),
  generated: data.generated,
};

export const CPI_REFERENCE = data.cpi_u_reference;

/**
 * Measured adjustments for the model's two simplifications, from
 * analysis/futa_adjustments.py: raw CPS ASEC employer fields joined to the
 * model's persons by CPS person id. `adjustments.json` is a copy of
 * analysis/futa_adjustments.json (a test asserts they are identical).
 */
type AdjustmentRow = Record<string, number | Record<string, number>> & { year: number };
type AdjustmentsFile = {
  asec_survey_years: number[];
  asec_match_rate: number;
  results: AdjustmentRow[];
  validation: (Record<string, number> & { fiscal_year: number })[];
  raw_asec_census_weights: Record<string, number | Record<string, number>>;
  irs_w2_forms_filed_2024: number;
};
const adj = rawAdjustments as unknown as AdjustmentsFile;
const num = (row: AdjustmentRow, key: string) => row[key] as number;

export interface YearAdjustment {
  year: number;
  /** Baseline revenue with exempt wages removed and per-employer caps ($). */
  baselineAdjusted: number;
  /** Reform revenue with exempt wages removed and per-employer caps ($). */
  reformAdjusted: number;
  /** Additional revenue with exempt-employer wages removed (single cap). */
  additionalCovered: number;
  /** Additional revenue with exempt wages removed and per-employer caps (CPS-reported employers). */
  additionalCoveredPerEmployer: number;
  /** Additional revenue with per-employer caps only. */
  additionalPerEmployer: number;
}

export const ADJUSTMENTS: YearAdjustment[] = adj.results
  .filter((r) => 'reform_single_cap_all_wages' in r)
  .map((r) => ({
    year: r.year,
    baselineAdjusted: num(r, 'current_even_split_covered_wages'),
    reformAdjusted: num(r, 'reform_even_split_covered_wages'),
    additionalCovered: num(r, 'reform_single_cap_covered_wages') - num(r, 'current_single_cap_covered_wages'),
    additionalCoveredPerEmployer:
      num(r, 'reform_even_split_covered_wages') - num(r, 'current_even_split_covered_wages'),
    additionalPerEmployer: num(r, 'reform_even_split_all_wages') - num(r, 'current_even_split_all_wages'),
  }));

/**
 * The headline series (issue #5): model output with both measured
 * adjustments applied, i.e. exempt-employer wages removed and the wage base
 * applied per employer. One row per year, aligned with RESULTS.
 */
export interface AdjustedYearResult {
  year: number;
  wageBase: number;
  cpiUPriorYearAverage: number;
  baseline: number;
  reform: number;
  additional: number;
  workersWithWages: number;
  workersAbove7k: number;
}

export const ADJUSTED_RESULTS: AdjustedYearResult[] = RESULTS.map((r) => {
  const a = ADJUSTMENTS.find((x) => x.year === r.year) as YearAdjustment;
  return {
    year: r.year,
    wageBase: r.wageBase,
    cpiUPriorYearAverage: r.cpiUPriorYearAverage,
    baseline: a.baselineAdjusted,
    reform: a.reformAdjusted,
    additional: a.additionalCoveredPerEmployer,
    workersWithWages: r.workersWithWages,
    workersAbove7k: r.workersAbove7k,
  };
});

export const ADJUSTED_FIRST = ADJUSTED_RESULTS[0];
export const TEN_YEAR_ADJUSTED = ADJUSTED_RESULTS.reduce((sum, r) => sum + r.additional, 0);

const firstAdj = adj.results.find((r) => r.year === RESULTS[0].year) as AdjustmentRow;
const census = adj.raw_asec_census_weights as Record<string, number>;

export const ADJUSTMENT_SUMMARY = {
  asecSurveyYears: adj.asec_survey_years,
  exemptShareCurrentBase: num(firstAdj, 'current_exempt_share_of_capped_wages'),
  exemptShareReformBase: num(firstAdj, 'reform_exempt_share_of_capped_wages'),
  governmentShareReformBase: num(firstAdj, 'reform_government_share_of_capped_wages'),
  /** Per-employer uplift to baseline, reform and additional revenue: [Census weights, model weights]. */
  baselineUplift: [
    census.current_per_employer_uplift,
    num(firstAdj, 'current_even_split_all_wages') / num(firstAdj, 'current_single_cap_all_wages') - 1,
  ],
  reformUplift: [
    census.reform_2026_per_employer_uplift,
    num(firstAdj, 'reform_even_split_all_wages') / num(firstAdj, 'reform_single_cap_all_wages') - 1,
  ],
  additionalUplift: [
    census.additional_per_employer_uplift,
    ADJUSTMENTS[0].additionalPerEmployer / RESULTS[0].additional - 1,
  ],
  shareWithTwoOrMoreEmployers: census.share_with_two_or_more_employers,
  meanEmployersPerWageEarner: census.mean_employers_per_wage_earner,
  w2FormsFiled2024: adj.irs_w2_forms_filed_2024,
  w2PerWageEarner: adj.irs_w2_forms_filed_2024 / census.wage_earners,
  tenYearCovered: ADJUSTMENTS.reduce((t, r) => t + r.additionalCovered, 0),
  tenYearCoveredPerEmployer: ADJUSTMENTS.reduce((t, r) => t + r.additionalCoveredPerEmployer, 0),
  /** Fiscal-year model vs IRS with both adjustments applied, by fiscal year. */
  adjustedValidationGaps: adj.validation.map((v) => ({
    fiscalYear: v.fiscal_year,
    gap: v.gap_even_split_covered_wages,
  })),
};

export function buildCsv(): string {
  const header =
    'calendar_year,taxable_wage_base_usd,cpi_u_prior_year_average,baseline_revenue_usd,reform_revenue_usd,additional_revenue_usd,unadjusted_baseline_revenue_usd,unadjusted_reform_revenue_usd,unadjusted_additional_revenue_usd,workers_with_wages,workers_with_wages_above_7000';
  const rows = RESULTS.map((r, i) => {
    const a = ADJUSTED_RESULTS[i];
    return `${r.year},${r.wageBase},${r.cpiUPriorYearAverage.toFixed(3)},${Math.round(a.baseline)},${Math.round(a.reform)},${Math.round(a.additional)},${Math.round(r.baseline)},${Math.round(r.reform)},${Math.round(r.additional)},${Math.round(r.workersWithWages)},${Math.round(r.workersAbove7k)}`;
  });
  return [header, ...rows].join('\n') + '\n';
}

export const CSV_FILENAME = `futa_wage_base_estimates_policyengine-us-${MODEL_INFO.policyengineUs}.csv`;
