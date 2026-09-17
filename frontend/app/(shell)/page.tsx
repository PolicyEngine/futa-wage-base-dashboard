'use client';

import { useId, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ChartWatermark from '@/components/ChartWatermark';
import {
  RESULTS,
  FIRST,
  LAST,
  TEN_YEAR_TOTAL,
  ADJUSTED_RESULTS,
  ADJUSTED_FIRST,
  TEN_YEAR_ADJUSTED,
  MODEL_INFO,
  VALIDATION,
  SURCHARGES,
  CPI_REFERENCE,
  CURRENT_BASE,
  NET_RATE,
  ADJUSTMENTS,
  ADJUSTMENT_SUMMARY,
  buildCsv,
  CSV_FILENAME,
} from '@/lib/data';
import {
  formatBillions,
  formatBillionsLong,
  formatDollars,
  formatMillionDollars,
  formatMillions,
  formatMonth,
  formatPercent,
  formatSignedPercent,
} from '@/lib/format';
import { REPO_URL } from '@/lib/site';

const TICK_STYLE = { fontFamily: 'var(--font-sans)', fontSize: 12 };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--chart-tooltip-bg)',
        border: '1px solid var(--chart-tooltip-border)',
        borderRadius: 8,
        padding: '8px 12px',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
      }}
    >
      {label != null && (
        <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text-heading)' }}>{label}</p>
      )}
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: 0, color: entry.color || 'var(--text-body)' }}>
          {entry.name}: {formatBillions(entry.value)}
        </p>
      ))}
    </div>
  );
}

function downloadCsv() {
  const url = URL.createObjectURL(new Blob([buildCsv()], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = CSV_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const TABS = [
  { id: 'estimates', label: 'Estimates' },
  { id: 'validation', label: 'Validation and methods' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const SOURCES = [
  {
    href: 'https://www.ssa.gov/cgi-bin/netcomp.cgi?year=2023',
    text: 'Social Security Administration, Wage statistics for 2023 (median net compensation $43,222.81)',
  },
  {
    href: 'https://www.irs.gov/statistics/soi-tax-stats-collections-and-refunds-by-type-of-tax-irs-data-book-table-1-1',
    text: 'IRS Data Book Table 1-1 (Table 1 before 2025), Collections and refunds by type of tax, unemployment insurance line',
  },
  {
    href: 'https://fiscaldata.treasury.gov/static-data/published-reports/mts/MonthlyTreasuryStatement_202509.pdf',
    text: 'Treasury, Monthly Treasury Statement, September 2025 (federal unemployment taxes by month)',
  },
  {
    href: 'https://www.irs.gov/pub/irs-pdf/i940.pdf',
    text: 'IRS, Instructions for Form 940 (deposit schedule and credit-reduction payment timing)',
  },
  {
    href: 'https://oui.doleta.gov/unemploy/futa_credit.asp',
    text: 'U.S. Department of Labor, FUTA credit reductions by state and year',
  },
  {
    href: 'https://www.law.cornell.edu/uscode/text/26/3306',
    text: '26 U.S.C. 3306, FUTA definitions (exempt employment in subsection (c))',
  },
  {
    href: 'https://www.census.gov/data/datasets/time-series/demo/cps/cps-asec.html',
    text: 'Census Bureau, Current Population Survey Annual Social and Economic Supplement, 2023 to 2025 public-use files (employers last year, class of worker, wages by employer)',
  },
  {
    href: 'https://www.irs.gov/pub/irs-pdf/p6961.pdf',
    text: 'IRS Publication 6961, Calendar year projections of information and withholding documents (Forms W-2 filed in 2024)',
  },
  {
    href: 'https://www.bls.gov/bdm/nonprofits/nonprofits.htm',
    text: 'BLS, Research data on the nonprofit sector (501(c)(3) employment, 2022)',
  },
  {
    href: 'https://www.cbo.gov/budget-options/2018/54809',
    text: 'CBO, Increase taxes that finance the federal share of the unemployment insurance system (December 2018)',
  },
  {
    href: 'https://home.treasury.gov/system/files/131/General-Explanations-FY2017.pdf',
    text: 'Treasury, General explanations of the administration’s FY2017 revenue proposals (FUTA base expansion)',
  },
  {
    href: 'https://www.cbo.gov/publication/61179',
    text: 'CBO, Unemployment insurance: budgetary history and projections (January 2025)',
  },
  {
    href: 'https://www.cbo.gov/publication/58549',
    text: 'CBO, How CBO and JCT account for the income and payroll tax offset (November 2022)',
  },
  {
    href: 'https://www.jct.gov/publications/2016/jcx-89-16/',
    text: 'JCT, JCX-89-16, Modeling the offset for payroll tax proposals (November 2016)',
  },
  {
    href: 'https://www.congress.gov/crs-product/R44527',
    text: 'CRS R44527, The fundamentals of the Federal Unemployment Tax (2016)',
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('estimates');
  const [selectedYear, setSelectedYear] = useState(FIRST.year);
  const selected = RESULTS.find((r) => r.year === selectedYear) ?? FIRST;
  const selectedAdjusted =
    ADJUSTED_RESULTS.find((r) => r.year === selectedYear) ?? ADJUSTED_FIRST;
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    estimates: null,
    validation: null,
  });
  const chartCaptionId = useId();
  const yearLegendId = useId();

  const chartData = ADJUSTED_RESULTS.map((r) => ({
    year: r.year,
    Baseline: r.baseline,
    'Additional revenue': r.additional,
  }));

  const basePerWorker = NET_RATE * CURRENT_BASE;
  const maxPerWorker = NET_RATE * selected.wageBase;
  const increasePerAffected = selected.additional / selected.workersAbove7k;
  const avgPerAffected = basePerWorker + increasePerAffected;
  const affectedShare = selected.workersAbove7k / selected.workersWithWages;
  const reformMultiple = ADJUSTED_FIRST.reform / ADJUSTED_FIRST.baseline;

  const S = ADJUSTMENT_SUMMARY;
  const gapLabels = S.adjustedValidationGaps.map((g) => formatPercent(Math.abs(g.gap), 0));
  const adjustedGapText = gapLabels.every((g) => g === gapLabels[0])
    ? `${gapLabels[0]} below in fiscal ${S.adjustedValidationGaps.map((g) => g.fiscalYear).join(' and ')}`
    : S.adjustedValidationGaps
        .map((g, i) => `${gapLabels[i]} below in fiscal ${g.fiscalYear}`)
        .join(' and ');
  const surcharge2024 = SURCHARGES[2024];
  const surcharge2025 = SURCHARGES[2025];

  function onTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const ids = TABS.map((t) => t.id);
    const i = ids.indexOf(activeTab);
    let next: TabId | null = null;
    if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length];
    if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length];
    if (e.key === 'Home') next = ids[0];
    if (e.key === 'End') next = ids[ids.length - 1];
    if (next) {
      e.preventDefault();
      setActiveTab(next);
      tabRefs.current[next]?.focus();
    }
  }

  return (
    <main className="min-h-screen">
      {/* Hero band */}
      <div className="bg-teal-500 text-white py-8 px-4 shadow-md">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">FUTA taxable wage base dashboard</h1>
          <p className="text-lg opacity-90">
            FUTA revenue effects of raising the taxable wage base from {formatDollars(CURRENT_BASE)}{' '}
            to {formatDollars(FIRST.wageBase)} in {FIRST.year} and indexing it to inflation (CPI-U)
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Tab bar */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Dashboard sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={onTabKeyDown}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                activeTab === tab.id
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'estimates' && (
          <div
            role="tabpanel"
            id="panel-estimates"
            aria-labelledby="tab-estimates"
            tabIndex={0}
            className="space-y-6 focus-visible:outline-none"
          >
            {/* Overview */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
              <div className="space-y-3 text-gray-700">
                <p>
                  The Federal Unemployment Tax Act (FUTA) taxes employers 6.0% on the first{' '}
                  {formatDollars(CURRENT_BASE)} each employee earns in a year. Employers that pay
                  their state unemployment taxes on time receive a credit of up to 5.4 percentage
                  points, so most pay a net 0.6%, at most {formatDollars(basePerWorker)} per
                  worker per year. The {formatDollars(CURRENT_BASE)} taxable wage base has not
                  changed since 1983. FUTA revenue pays for state administration of unemployment
                  insurance, half the cost of Extended Benefits, and loans to states whose
                  unemployment trust funds run short.
                </p>
                <p>
                  This dashboard estimates the FUTA revenue from raising the wage base to{' '}
                  {formatDollars(FIRST.wageBase)} in {FIRST.year} and then indexing it each year
                  to the Consumer Price Index for All Urban Consumers (CPI-U), rounding the base
                  to the nearest $100, while holding the 6.0% rate and the 5.4% maximum credit
                  constant. The {formatDollars(FIRST.wageBase)} figure is roughly the median
                  annual wage of U.S. workers in 2023 ($43,223, per the Social Security
                  Administration&apos;s wage statistics). Under CBO&apos;s inflation projections
                  the base reaches {formatDollars(LAST.wageBase)} in {LAST.year}.
                </p>
                <p>
                  The estimates on this tab adjust the model&apos;s output for two corrections
                  measured from workers&apos; Census survey responses: wages at FUTA-exempt
                  employers (government agencies and nonprofits, about{' '}
                  {formatPercent(S.exemptShareReformBase, 0)} of wages under the{' '}
                  {formatDollars(FIRST.wageBase)} base) are removed, and the wage base applies
                  per employer rather than per worker, as the law does. Before these adjustments
                  the model&apos;s output is {formatBillions(FIRST.additional)} in {FIRST.year}{' '}
                  and {formatBillions(TEN_YEAR_TOTAL)} over ten years; both series appear in the
                  CSV, and the Validation and methods tab documents the adjustments.
                </p>
                <p>
                  All years on this tab are calendar (tax) years. The estimates count only the
                  FUTA line; state unemployment taxes, which would also rise because states must
                  match the federal base, are discussed under Validation and methods.
                </p>
              </div>

              {/* Headline stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-teal-50 border border-teal-100 rounded-lg p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Additional revenue, {FIRST.year} to {LAST.year}
                  </p>
                  <p className="text-3xl font-bold text-teal-600 tabular-nums">
                    {formatBillions(TEN_YEAR_ADJUSTED)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Ten calendar years; assumes wages do not respond to the tax (
                    {formatBillions(TEN_YEAR_TOTAL)} before adjustments)
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    First year ({FIRST.year})
                  </p>
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">
                    +{formatBillions(ADJUSTED_FIRST.additional)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    FUTA revenue rises from {formatBillions(ADJUSTED_FIRST.baseline)} to{' '}
                    {formatBillions(ADJUSTED_FIRST.reform)}, {reformMultiple.toFixed(1)} times
                    the current-law level
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Wage base path
                  </p>
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">
                    {formatDollars(FIRST.wageBase)} to {formatDollars(LAST.wageBase)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {FIRST.year} to {LAST.year}, indexed to the CPI-U
                  </p>
                </div>
              </div>
            </section>

            {/* Budgetary impact */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-900">FUTA revenue by year</h2>
                <button
                  type="button"
                  onClick={downloadCsv}
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-teal-500 hover:bg-teal-600 active:bg-teal-700 transition-colors shadow-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  Download CSV
                </button>
              </div>

              {/* Year picker */}
              <fieldset className="mb-6">
                <legend id={yearLegendId} className="sr-only">
                  Select a year
                </legend>
                <div className="flex flex-wrap items-center gap-2">
                  {RESULTS.map((r) => (
                    <label key={r.year} className="cursor-pointer">
                      <input
                        type="radio"
                        name="year"
                        value={r.year}
                        checked={selectedYear === r.year}
                        onChange={() => setSelectedYear(r.year)}
                        className="sr-only peer"
                      />
                      <span
                        className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium transition-colors tabular-nums peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-700 ${
                          selectedYear === r.year
                            ? 'bg-teal-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {r.year}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Selected year detail */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-teal-50 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Additional revenue
                  </p>
                  <p className="text-2xl font-bold text-teal-600 tabular-nums">
                    +{formatBillions(selectedAdjusted.additional)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">vs. current law in {selected.year}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Taxable wage base
                  </p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {formatDollars(selected.wageBase)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selected.year === FIRST.year
                      ? 'Set by the reform'
                      : `Prior-year CPI-U ${selected.cpiUPriorYearAverage.toFixed(1)}`}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Baseline revenue
                  </p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {formatBillions(selectedAdjusted.baseline)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDollars(CURRENT_BASE)} base, 0.6% net rate
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Reform revenue
                  </p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {formatBillions(selectedAdjusted.reform)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(selectedAdjusted.reform / selectedAdjusted.baseline).toFixed(1)} times
                    baseline
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-6">
                Under current law an employer owes at most {formatDollars(basePerWorker)} a year
                in FUTA tax for each worker (0.6% of {formatDollars(CURRENT_BASE)}). Under the
                reform the maximum rises to {formatDollars(maxPerWorker)} (0.6% of{' '}
                {formatDollars(selected.wageBase)}), a {formatDollars(maxPerWorker - basePerWorker)}{' '}
                increase, for every worker earning {formatDollars(selected.wageBase)} or more in{' '}
                {selected.year}. Averaged over the {formatMillions(selected.workersAbove7k)}{' '}
                workers earning more than {formatDollars(CURRENT_BASE)} ({formatPercent(affectedShare, 0)}{' '}
                of the {formatMillions(selected.workersWithWages)} people with any wages), the
                liability would be {formatDollars(avgPerAffected)} per worker, up{' '}
                {formatDollars(increasePerAffected)} from today. The per-worker averages use the
                unadjusted series, which includes workers at exempt employers.
              </p>

              {/* Chart */}
              <figure className="relative" aria-labelledby={chartCaptionId}>
                <figcaption id={chartCaptionId} className="sr-only">
                  FUTA revenue by calendar year, {FIRST.year} to {LAST.year}, in billions of
                  dollars, with the exempt-employer and per-employer adjustments applied:
                  revenue at the current {formatDollars(CURRENT_BASE)} base plus the additional
                  revenue from the {formatDollars(FIRST.wageBase)} indexed base. The CSV
                  download has the underlying numbers, adjusted and unadjusted.
                </figcaption>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 32, bottom: 5 }}
                    accessibilityLayer
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--chart-grid)"
                    />
                    <XAxis dataKey="year" tick={TICK_STYLE} stroke="var(--chart-axis)" />
                    <YAxis
                      tickFormatter={formatBillions}
                      tick={TICK_STYLE}
                      stroke="var(--chart-axis)"
                      label={{
                        value: 'FUTA revenue ($ billions)',
                        angle: -90,
                        position: 'insideLeft',
                        offset: -20,
                        style: { ...TICK_STYLE, textAnchor: 'middle', fill: 'var(--text-body)' },
                      }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontFamily: 'var(--font-sans)', fontSize: 13 }} />
                    <Bar dataKey="Baseline" stackId="a" fill="var(--chart-baseline)" />
                    <Bar
                      dataKey="Additional revenue"
                      stackId="a"
                      fill="var(--chart-additional)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <ChartWatermark />
              </figure>
            </section>
          </div>
        )}

        {activeTab === 'validation' && (
          <div
            role="tabpanel"
            id="panel-validation"
            aria-labelledby="tab-validation"
            tabIndex={0}
            className="space-y-6 focus-visible:outline-none"
          >
            {/* Two baselines */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Model baseline vs. IRS collections
              </h2>
              <div className="space-y-3 text-gray-700">
                <p>
                  The model computes FUTA revenue at the current {formatDollars(CURRENT_BASE)}{' '}
                  wage base with every employer at the full 5.4% credit,{' '}
                  {formatBillionsLong(FIRST.baseline)} in {FIRST.year} before adjustments. The
                  reform applies the same 0.6% net rate, so the additional-revenue figure
                  isolates the wage-base change. The Estimates tab applies the two adjustments
                  measured in the next section. The cards below compare the unadjusted output
                  with collections; with both adjustments applied the model runs{' '}
                  {adjustedGapText}, and the next section explains why.
                </p>
                <p>
                  IRS collections run higher. They include penalties and interest, and they
                  include credit-reduction surcharges: the extra 0.3 percentage points or more,
                  rising each year, that employers owe in a state with an unpaid federal
                  unemployment-insurance loan. In 2024 California and New York each owed 0.9
                  points and the Virgin Islands 4.2; in 2025 California owed 1.2 points and the
                  Virgin Islands 4.5, with New York out after repaying its loan in June 2025. The
                  model puts the California and New York surcharges at{' '}
                  {formatBillionsLong(surcharge2024)} for 2024 and{' '}
                  {formatBillionsLong(surcharge2025)} for 2025. The dataset covers the 50 states
                  and DC, so it has no Virgin Islands employers. The projection excludes
                  surcharges because they end as states repay their loans, and future loan
                  balances depend on state financing decisions the model does not forecast.
                </p>
                <p>
                  IRS figures are federal fiscal-year cash (October through September), gross of
                  refunds. Employers deposit the base tax quarterly and pay a tax year&apos;s
                  credit-reduction surcharge with the fourth-quarter deposit due January 31 of the
                  following year, so fiscal year t holds roughly the base tax for calendar year t
                  plus the surcharge for calendar year t&minus;1. The model figures below are
                  built the same way. Timing within the year is approximate: about a quarter of
                  a calendar year&apos;s base tax is deposited after September 30.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {VALIDATION.map((v) => {
                  const diff = (v.modelFiscalYear - v.irsGross) / v.irsGross;
                  return (
                    <div
                      key={v.fiscalYear}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-5"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                        Fiscal year {v.fiscalYear} (Oct {v.fiscalYear - 1} to Sep {v.fiscalYear})
                      </p>
                      <p className="text-sm text-gray-500">IRS gross collections</p>
                      <p className="text-3xl font-bold text-gray-900 tabular-nums mb-1">
                        {formatBillions(v.irsGross)}
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        Before refunds of {formatMillionDollars(v.irsRefunds)}; includes penalties
                        and interest
                      </p>
                      <p className="text-sm text-gray-500">Model, fiscal-year basis</p>
                      <p className="text-3xl font-bold text-teal-600 tabular-nums mb-1">
                        {formatBillions(v.modelFiscalYear)}
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        0.6% base tax for {v.fiscalYear} ({formatBillions(v.modelFlatCalendarYear)}
                        ) plus the {v.fiscalYear - 1} surcharge (
                        {formatBillions(v.modelSurchargePriorYear)}
                        {v.priorYearModeled
                          ? ''
                          : `, ${v.fiscalYear - 1} rates applied to the 2024 wage distribution because the dataset has no ${v.fiscalYear - 1} weights`}
                        )
                      </p>
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 tabular-nums">
                        Model {formatSignedPercent(diff)} vs. IRS
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-sm text-gray-600 mt-3">
                The model runs a few percent below collections in both years. Two
                simplifications with opposite effects on baseline revenue sit behind that figure
                (next section). Penalties and interest, which the IRS does not break out, are in
                the IRS line and not in the model.
              </p>
            </section>

            {/* Key modeling choices */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Two simplifications that shape the estimates
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-5">
                  <p className="text-sm font-bold text-gray-900 mb-2">
                    Wages at FUTA-exempt employers are included
                  </p>
                  <p className="text-sm text-gray-700">
                    Federal, state, local and tribal governments, 501(c)(3) nonprofits, railroads,
                    and small farm and household employers are exempt from FUTA, but their
                    employees&apos; wages stay in the model&apos;s tax base. Workers&apos; own
                    reports of their employer type in the Census Bureau&apos;s Current Population
                    Survey put government and private nonprofit employers at{' '}
                    {formatPercent(S.exemptShareCurrentBase)} of wages under the{' '}
                    {formatDollars(CURRENT_BASE)} base and {formatPercent(S.exemptShareReformBase)}{' '}
                    under the {formatDollars(FIRST.wageBase)} base (government alone,{' '}
                    {formatPercent(S.governmentShareReformBase)}). Removing those wages lowers
                    the unadjusted {FIRST.year} gain from {formatBillions(FIRST.additional)} to{' '}
                    {formatBillions(ADJUSTMENTS[0].additionalCovered)} and the ten-year total
                    from {formatBillions(TEN_YEAR_TOTAL)} to {formatBillions(S.tenYearCovered)}.
                    The survey&apos;s nonprofit category is broader than 501(c)(3), and the
                    smaller exempt groups cannot be identified in it.
                  </p>
                </div>
                <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-5">
                  <p className="text-sm font-bold text-gray-900 mb-2">
                    One wage base per worker, not per employer
                  </p>
                  <p className="text-sm text-gray-700">
                    FUTA applies the wage base separately to each employee at each employer. The
                    model applies a single cap to each worker&apos;s total annual wages. The
                    survey asks how many employers each worker had and how much they earned
                    outside their main job:{' '}
                    {formatPercent(S.shareWithTwoOrMoreEmployers, 0)} of wage earners report two
                    or more employers. Capping those wages per employer raises baseline revenue
                    by {formatPercent(S.baselineUplift[0], 0)} to{' '}
                    {formatPercent(S.baselineUplift[1], 0)} and reform revenue by{' '}
                    {formatPercent(S.reformUplift[0], 0)} to {formatPercent(S.reformUplift[1], 0)},
                    so the additional-revenue figure rises by{' '}
                    {formatPercent(S.additionalUplift[0], 0)} to{' '}
                    {formatPercent(S.additionalUplift[1], 0)}. The range runs from Census survey
                    weights to this model&apos;s weights, which over-represent workers with
                    several employers.
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-700 mt-4">
                With both adjustments the {FIRST.year} gain is{' '}
                {formatBillions(ADJUSTMENTS[0].additionalCoveredPerEmployer)} and the ten-year
                total {formatBillions(S.tenYearCoveredPerEmployer)}; these are the headline
                figures on the Estimates tab. The unadjusted model output is{' '}
                {formatBillions(FIRST.additional)} and {formatBillions(TEN_YEAR_TOTAL)}.
              </p>
              <p className="text-sm text-gray-600 mt-3">
                The same two adjustments move the fiscal-year comparison above from a few percent
                below IRS collections to{' '}
                {adjustedGapText}
                , so the unadjusted model&apos;s closeness to collections reflects two errors that
                offset. The remaining shortfall points at employers per worker: the survey counts
                simultaneous jobs as one employer and reports{' '}
                {S.meanEmployersPerWageEarner.toFixed(2)} employers per wage earner, while
                employers filed {formatMillions(S.w2FormsFiled2024)} Forms W-2 in 2024, about{' '}
                {S.w2PerWageEarner.toFixed(1)} per wage earner. More employers per worker raises
                revenue at the {formatDollars(CURRENT_BASE)} base far more than at the{' '}
                {formatDollars(FIRST.wageBase)} base.
              </p>
            </section>

            {/* How this compares */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                How this compares with CBO and Treasury
              </h2>
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  State unemployment taxes are deposited in the federal Unemployment Trust Fund
                  and count as federal revenue in the budget. Federal law requires state taxable
                  wage bases to be at least the FUTA base, so this reform would raise most
                  states&apos; bases to {formatDollars(FIRST.wageBase)} (39 states and DC are
                  below it in 2026). This dashboard counts only the FUTA line. A CBO score would
                  also count the state base expansion and the state rate cuts CBO assumes in
                  response, and that state line is the larger one.
                </p>
                <p>
                  CBO&apos;s most recent FUTA option (December 2018) raised the base to $40,000 in
                  2019, indexed it to wage growth, and cut the net rate from 0.6% to 0.167%. CBO
                  scored it at $18 billion over 2019 to 2028, most of it from state taxes.
                  Treasury&apos;s FY2017 budget proposed the same base and rate with new state
                  solvency rules and scored it at $46 billion over 2017 to 2026. Neither is this
                  policy: this dashboard holds the 0.6% rate, indexes to prices, and counts
                  FUTA alone. At CBO&apos;s 0.167% rate, the same {formatDollars(FIRST.wageBase)}{' '}
                  base would raise about{' '}
                  {formatBillions((FIRST.reform * 0.167) / 0.6 - FIRST.baseline)} a year in FUTA.
                  CBO and Treasury totals are fiscal years; this dashboard&apos;s are calendar
                  years.
                </p>
                <p>
                  CBO&apos;s January 2025 unemployment insurance report puts FUTA revenue at
                  almost $8 billion in 2023 and more than $8 billion in 2025, which brackets the
                  model&apos;s fiscal-year-basis figures above.
                </p>
              </div>
            </section>

            {/* Methodology and sources */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Methodology and sources</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  <strong>Assumptions.</strong> The estimates assume that:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    The new base is {formatDollars(FIRST.wageBase)}, roughly the 2023 median
                    annual wage of U.S. workers ($43,223, SSA), applied in {FIRST.year} without
                    adjustment for wage growth since 2023, then indexed to the CPI-U from{' '}
                    {FIRST.year + 1}.
                  </li>
                  <li>
                    Every employer pays the 0.6% net FUTA rate (6.0% minus the full 5.4% credit)
                    in both the baseline and the reform on the Estimates tab; the fiscal-year
                    comparison above adds the statutory credit-reduction surcharges.
                  </li>
                  <li>
                    States raise their UI taxable wage bases to at least the federal base, as
                    federal law effectively requires, so the full credit applies to the whole
                    base.
                  </li>
                  <li>
                    The headline estimates remove wages at FUTA-exempt employers and apply the
                    wage base per employer, both as measured from workers&apos; CPS responses
                    (see the two simplifications above); the unadjusted model output applies one
                    cap per worker and keeps exempt wages in the base.
                  </li>
                  <li>Wages do not change in response to the tax.</li>
                  <li>
                    The wage base grows with the CPI-U: BLS values through{' '}
                    {formatMonth(CPI_REFERENCE.last_observed_month)} and CBO&apos;s February 2026
                    projections after.
                  </li>
                </ul>
                <p>
                  The additional-revenue figure is reform revenue minus baseline revenue under
                  these same assumptions.
                </p>
                <p>
                  <strong>Model and data.</strong> Estimates use PolicyEngine&apos;s US
                  microsimulation model, policyengine-us {MODEL_INFO.policyengineUs}, run through
                  the policyengine package ({MODEL_INFO.policyengine}) on its certified Microcosm
                  US 2024 national dataset (build{' '}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                    {MODEL_INFO.datasetBuild}
                  </code>
                  ), about 57,000 households representing the 50 states and DC. The model runs
                  one simulation per year from {FIRST.year} to {LAST.year}, growing 2024 wages
                  with CBO&apos;s wage projections.
                </p>
                <p>
                  <strong>How the revenue is computed.</strong> Within each simulated year, a
                  worker&apos;s FUTA liability is 0.6% of their wages (the person-level{' '}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                    payroll_tax_gross_wages
                  </code>{' '}
                  variable: wages and salaries including 401(k) deferrals and tips, excluding
                  pre-tax health and HSA contributions) up to the taxable wage base. Because the
                  tax is linear in the wage base, the baseline and the reform read from the same
                  simulated wage distribution: revenue under each scenario is the weighted sum of
                  min(wages, base) &times; 0.6%. The calculation script and its unedited output
                  are in the{' '}
                  <a
                    href={`${REPO_URL}/tree/main/analysis`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:text-teal-700 underline"
                  >
                    dashboard&apos;s GitHub repository
                  </a>
                  , and the page reads that output directly.
                </p>
                <p>
                  <strong>Indexing.</strong> The {formatDollars(FIRST.wageBase)} base applies in{' '}
                  {FIRST.year}. For each later year the base is{' '}
                  {formatDollars(FIRST.wageBase)} times the ratio of the prior calendar
                  year&apos;s average CPI-U to the {CPI_REFERENCE.calendar_year} average (
                  {CPI_REFERENCE.average.toFixed(1)}), rounded to the nearest $100. The CPI-U
                  series is the model&apos;s: BLS monthly values through{' '}
                  {formatMonth(CPI_REFERENCE.last_observed_month)}, CBO calendar-year projections
                  after that, with the remaining months of the current year interpolated between
                  the two. This is a modeling choice, not a statutory rule; an enacted reform
                  would specify its own rule and follow realized inflation. Earlier proposals
                  to raise the base (CBO 2018, Treasury FY2017) indexed it to wage growth rather
                  than prices.
                </p>
                <p>
                  <strong>No behavioral response.</strong> FUTA is an employer-side tax. CBO and
                  JCT assume employers offset higher payroll taxes with lower cash compensation,
                  which reduces income and payroll tax receipts. JCT sizes that offset proposal
                  by proposal (it historically used 10% for payroll taxes and applies about 25%
                  to excise taxes). The figures here are gross of any such offset; a 10% to 25%
                  offset would put the {FIRST.year} figure at{' '}
                  {formatBillions(FIRST.additional * 0.75)} to {formatBillions(FIRST.additional * 0.9)}
                  .
                </p>
                <p>
                  <strong>Surcharge assignment.</strong> In the fiscal-year comparison, each
                  state&apos;s credit-reduction surcharge is assigned by the worker&apos;s state
                  of residence, a proxy for the state whose unemployment program covers the job.
                </p>
              </div>
              <ul className="mt-4 space-y-1 text-sm">
                {SOURCES.map(({ href, text }) => (
                  <li key={href}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 hover:text-teal-700 underline"
                    >
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
