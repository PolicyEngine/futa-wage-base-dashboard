import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RESULTS,
  FIRST,
  LAST,
  TEN_YEAR_TOTAL,
  VALIDATION,
  SURCHARGES,
  MODEL_INFO,
  CPI_REFERENCE,
  CURRENT_BASE,
  NET_RATE,
  buildCsv,
  CSV_FILENAME,
  ADJUSTMENTS,
  ADJUSTMENT_SUMMARY,
} from '@/lib/data';
import { formatBillions, formatDollars, formatSignedPercent } from '@/lib/format';

const ANALYSIS = resolve(__dirname, '../../analysis');
const analysisJson = JSON.parse(readFileSync(resolve(ANALYSIS, 'futa_results.json'), 'utf8'));
const frontendJson = JSON.parse(readFileSync(resolve(__dirname, '../lib/results.json'), 'utf8'));

describe('results.json provenance', () => {
  it('is byte-identical to the analysis output', () => {
    expect(readFileSync(resolve(__dirname, '../lib/results.json'), 'utf8')).toBe(
      readFileSync(resolve(ANALYSIS, 'futa_results.json'), 'utf8'),
    );
  });

  it('records released package versions and the certified dataset', () => {
    expect(MODEL_INFO.policyengineUs).toMatch(/^\d+\.\d+\.\d+$/);
    expect(MODEL_INFO.policyengine).toMatch(/^\d+\.\d+\.\d+$/);
    expect(analysisJson.bundle.managed_by).toBe('policyengine.py');
    expect(analysisJson.bundle.model_version).toBe(MODEL_INFO.policyengineUs);
    expect(MODEL_INFO.datasetBuild).toBe(analysisJson.bundle.certified_data_build_id);
    expect(analysisJson.bundle.runtime_dataset_sha256).toBe(
      analysisJson.bundle.certified_data_artifact_sha256,
    );
  });

  it('confirms the script formula against the model FUTA variable in every benchmark year', () => {
    for (const row of frontendJson.results) {
      if (row.baseline_revenue_statutory !== undefined) {
        expect(Math.abs(row.baseline_revenue_statutory - row.model_futa_variable_check)).toBeLessThan(1);
      }
    }
  });
});

describe('RESULTS', () => {
  it('covers 2026 to 2035 in order', () => {
    expect(RESULTS.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
  });

  it('has additional = reform - baseline in every year', () => {
    for (const r of RESULTS) {
      expect(Math.abs(r.reform - r.baseline - r.additional)).toBeLessThanOrEqual(1);
      expect(r.reform).toBeGreaterThan(r.baseline);
    }
  });

  it('starts at $43,000 and grows in $100 steps with the prior-year CPI-U', () => {
    expect(FIRST.wageBase).toBe(43000);
    for (const r of RESULTS) expect(r.wageBase % 100).toBe(0);
    for (let i = 1; i < RESULTS.length; i++) {
      const r = RESULTS[i];
      expect(r.wageBase).toBeGreaterThan(RESULTS[i - 1].wageBase);
      const expected = Math.round((43000 * r.cpiUPriorYearAverage) / CPI_REFERENCE.average / 100) * 100;
      expect(r.wageBase).toBe(expected);
    }
    expect(CPI_REFERENCE.calendar_year).toBe(2025);
  });

  it('keeps year-over-year base growth within CBO-like inflation (no spliced jump)', () => {
    for (let i = 1; i < RESULTS.length; i++) {
      const growth = RESULTS[i].wageBase / RESULTS[i - 1].wageBase - 1;
      expect(growth).toBeGreaterThan(0.01);
      expect(growth).toBeLessThan(0.04);
    }
  });

  it('counts most wage earners as above the $7,000 base', () => {
    for (const r of RESULTS) {
      expect(r.workersAbove7k).toBeLessThan(r.workersWithWages);
      expect(r.workersAbove7k / r.workersWithWages).toBeGreaterThan(0.85);
    }
  });

  it('ten-year total is the sum of the yearly gains', () => {
    const sum = RESULTS.reduce((s, r) => s + r.additional, 0);
    expect(TEN_YEAR_TOTAL).toBe(sum);
    expect(LAST.year).toBe(2035);
  });
});

describe('VALIDATION', () => {
  it('has fiscal years 2024 and 2025 with IRS gross collections from the Data Book', () => {
    expect(VALIDATION.map((v) => v.fiscalYear)).toEqual([2024, 2025]);
    expect(VALIDATION[0].irsGross).toBe(8_130_484_000);
    expect(VALIDATION[1].irsGross).toBe(8_776_869_000);
    expect(VALIDATION[0].irsRefunds).toBe(133_603_000);
    expect(VALIDATION[1].irsRefunds).toBe(148_702_000);
  });

  it('builds the fiscal-year model as flat base tax plus the prior year surcharge', () => {
    for (const v of VALIDATION) {
      expect(Math.abs(v.modelFiscalYear - v.modelFlatCalendarYear - v.modelSurchargePriorYear)).toBeLessThan(1);
    }
    expect(VALIDATION[1].modelSurchargePriorYear).toBeCloseTo(SURCHARGES[2024], 0);
    expect(VALIDATION[1].priorYearModeled).toBe(true);
  });

  it('lands within 6% of IRS collections in both years with the same sign', () => {
    const gaps = VALIDATION.map((v) => v.modelFiscalYear / v.irsGross - 1);
    for (const g of gaps) expect(Math.abs(g)).toBeLessThan(0.06);
    expect(Math.sign(gaps[0])).toBe(Math.sign(gaps[1]));
  });

  it('contains California and New York surcharges only (no Virgin Islands in the data)', () => {
    // 2025: California alone at 1.2%; 2024: California and New York at 0.9%.
    expect(SURCHARGES[2025]).toBeLessThan(SURCHARGES[2024]);
    expect(SURCHARGES[2025]).toBeGreaterThan(0);
    const approx = frontendJson.surcharge_approximations['2023'];
    expect(approx.states_with_rates).toEqual(['CA', 'NY']);
  });
});

describe('CSV download', () => {
  it('matches the committed analysis CSV byte for byte', () => {
    expect(buildCsv()).toBe(readFileSync(resolve(ANALYSIS, 'futa_wage_base_estimates.csv'), 'utf8'));
  });

  it('names the file with the model version', () => {
    expect(CSV_FILENAME).toContain(MODEL_INFO.policyengineUs);
  });
});

describe('formatters', () => {
  it('format billions, dollars and signed percents', () => {
    expect(formatBillions(26_445_727_221)).toBe('$26.4B');
    expect(formatDollars(NET_RATE * CURRENT_BASE)).toBe('$42');
    expect(formatDollars(43000)).toBe('$43,000');
    expect(formatSignedPercent(0.0353)).toBe('+3.5%');
    expect(formatSignedPercent(-0.0323)).toBe('−3.2%');
    expect(formatSignedPercent(0)).toBe('0.0%');
  });
});

describe('measured adjustments (raw ASEC join)', () => {
  it('adjustments.json is byte-identical to the analysis output', () => {
    expect(readFileSync(resolve(__dirname, '../lib/adjustments.json'), 'utf8')).toBe(
      readFileSync(resolve(ANALYSIS, 'futa_adjustments.json'), 'utf8'),
    );
  });

  it('matches every model person to a raw ASEC record and reproduces the published series', () => {
    const adj = JSON.parse(readFileSync(resolve(ANALYSIS, 'futa_adjustments.json'), 'utf8'));
    expect(adj.asec_match_rate).toBe(1);
    expect(adj.policyengine_us_version).toBe(MODEL_INFO.policyengineUs);
    for (const r of RESULTS) {
      const row = adj.results.find((x: { year: number }) => x.year === r.year);
      expect(Math.abs(row.current_single_cap_all_wages / r.baseline - 1)).toBeLessThan(1e-6);
      expect(Math.abs(row.reform_single_cap_all_wages / r.reform - 1)).toBeLessThan(1e-6);
    }
  });

  it('orders the adjusted figures as the mechanics require', () => {
    ADJUSTMENTS.forEach((a, i) => {
      // Removing exempt wages lowers the gain; per-employer caps never lower revenue levels.
      expect(a.additionalCovered).toBeLessThan(RESULTS[i].additional);
      expect(a.additionalCoveredPerEmployer).toBeLessThan(RESULTS[i].additional);
      expect(a.additionalCovered).toBeGreaterThan(0.7 * RESULTS[i].additional);
    });
    const S = ADJUSTMENT_SUMMARY;
    expect(S.exemptShareReformBase).toBeGreaterThan(0.18);
    expect(S.exemptShareReformBase).toBeLessThan(0.28);
    expect(S.governmentShareReformBase).toBeLessThan(S.exemptShareReformBase);
    for (const u of [...S.baselineUplift, ...S.reformUplift]) expect(u).toBeGreaterThan(0);
    // Extra employers matter more at the low base than at the high one.
    expect(S.baselineUplift[0]).toBeGreaterThan(S.reformUplift[0]);
    expect(S.baselineUplift[1]).toBeGreaterThan(S.reformUplift[1]);
    expect(S.w2PerWageEarner).toBeGreaterThan(S.meanEmployersPerWageEarner);
  });
});
