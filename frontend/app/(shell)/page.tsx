'use client';

import { useState } from 'react';
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
import { RESULTS, TEN_YEAR_TOTAL, MODEL_INFO, VALIDATION, buildCsv } from '@/lib/data';

const TICK_STYLE = { fontFamily: 'var(--font-sans)', fontSize: 12 };

const formatBillions = (value: number) => `$${(value / 1e9).toFixed(1)}B`;

const formatDollars = (value: number) => `$${value.toLocaleString('en-US')}`;

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
  a.download = 'futa_wage_base_estimates.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const TABS = [
  { id: 'impact', label: 'Overview & impact' },
  { id: 'validation', label: 'Validation' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('impact');
  const [selectedYear, setSelectedYear] = useState(RESULTS[0].year);
  const selected = RESULTS.find((r) => r.year === selectedYear) ?? RESULTS[0];

  const chartData = RESULTS.map((r) => ({
    year: r.year,
    Baseline: r.baseline,
    'Additional revenue': r.additional,
  }));

  const perWorker = selected.additional / selected.workersAbove7k;
  const maxPerWorker = 0.006 * (selected.wageBase - 7000);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero band */}
      <div className="bg-primary-500 text-white py-8 px-4 shadow-md">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">FUTA taxable wage base dashboard</h1>
          <p className="text-lg opacity-90">
            Federal revenue effects of raising the FUTA taxable wage base from $7,000 to $43,000
            in 2026 and indexing it to the CPI-U
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Tab bar */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Dashboard sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'impact' && (
          <>
            {/* Overview */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
              <div className="space-y-3 text-gray-700">
                <p>
                  The Federal Unemployment Tax Act (FUTA) levies a 6.0% tax on the first $7,000
                  of each worker&apos;s annual wages, reduced to an effective 0.6% for employers
                  that receive the full 5.4% credit for paying state unemployment taxes on time.
                  The $7,000 taxable wage base has not changed since 1983.
                </p>
                <p>
                  This dashboard estimates the federal revenue raised by increasing the wage base
                  to $43,000 in 2026 and indexing it to the Consumer Price Index for All Urban
                  Consumers (CPI-U) thereafter, rounded to the nearest $100, while holding the
                  6.0% rate and maximum 5.4% credit constant. Under CBO&apos;s inflation
                  projections, the base reaches $53,600 by 2035.
                </p>
              </div>

              {/* Headline stats — always visible */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-primary-50 border border-primary-100 rounded-lg p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Additional revenue, 2026&ndash;2035
                  </p>
                  <p className="text-3xl font-bold text-primary-600 tabular-nums">
                    {formatBillions(TEN_YEAR_TOTAL)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Ten-year total, static estimate</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    First year (2026)
                  </p>
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">+$26.4B</p>
                  <p className="text-sm text-gray-500 mt-1">
                    FUTA revenue rises from $6.8B to $33.3B, a 4.9&times; increase
                  </p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Wage base path
                  </p>
                  <p className="text-3xl font-bold text-gray-900 tabular-nums">
                    $43,000 &rarr; $53,600
                  </p>
                  <p className="text-sm text-gray-500 mt-1">2026 to 2035, indexed to the CPI-U</p>
                </div>
              </div>
            </section>

            {/* Budgetary impact */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Budgetary impact by year</h2>
                <button
                  onClick={downloadCsv}
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-primary-500 hover:bg-primary-600 active:bg-primary-700 transition-colors shadow-sm text-sm"
                >
                  Download CSV
                </button>
              </div>

              {/* Year bubbles */}
              <div
                className="flex flex-wrap items-center gap-2 mb-6"
                role="tablist"
                aria-label="Select year"
              >
                {RESULTS.map((r) => (
                  <button
                    key={r.year}
                    role="tab"
                    aria-selected={selectedYear === r.year}
                    onClick={() => setSelectedYear(r.year)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors tabular-nums ${
                      selectedYear === r.year
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {r.year}
                  </button>
                ))}
              </div>

              {/* Selected year detail */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-primary-50 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Additional revenue
                  </p>
                  <p className="text-2xl font-bold text-primary-600 tabular-nums">
                    +{formatBillions(selected.additional)}
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
                    CPI-U index {selected.cpiU.toFixed(1)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Baseline revenue
                  </p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {formatBillions(selected.baseline)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">$7,000 base, 0.6% net rate</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Reform revenue
                  </p>
                  <p className="text-2xl font-bold text-gray-900 tabular-nums">
                    {formatBillions(selected.reform)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(selected.reform / selected.baseline).toFixed(1)}&times; baseline
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-6">
                {(selected.workersAbove7k / 1e6).toFixed(0)} million workers earn above the
                current $7,000 base in {selected.year}. The reform raises employer-side FUTA
                liability by an average of ${perWorker.toFixed(0)} per affected worker (maximum $
                {maxPerWorker.toFixed(0)} for a worker at or above the{' '}
                {formatDollars(selected.wageBase)} base).
              </p>

              {/* Chart */}
              <div className="relative">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
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
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontFamily: 'var(--font-sans)', fontSize: 13 }} />
                    <Bar dataKey="Baseline" stackId="a" fill="var(--chart-negative)" />
                    <Bar
                      dataKey="Additional revenue"
                      stackId="a"
                      fill="var(--chart-positive)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <ChartWatermark />
              </div>
            </section>
          </>
        )}

        {activeTab === 'validation' && (
          <>
            {/* Estimates vs actual collections */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Model estimates vs. actual collections
              </h2>
              <p className="text-gray-700 mb-6">
                The IRS Data Book reports actual FUTA collections each fiscal year. For the years
                that overlap the model (2024 onward), the comparison below runs the model&apos;s
                baseline with the statutory credit-reduction rates actually in effect, matching
                what the IRS collects.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {VALIDATION.map((v) => {
                  const diff =
                    v.modelStatutory != null
                      ? (v.modelStatutory - v.irsActual) / v.irsActual
                      : null;
                  return (
                    <div
                      key={v.fiscalYear}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-5"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                        Fiscal year {v.fiscalYear}
                      </p>
                      <p className="text-sm text-gray-500">IRS actual collections</p>
                      <p className="text-3xl font-bold text-gray-900 tabular-nums mb-3">
                        {formatBillions(v.irsActual)}
                      </p>
                      {v.modelStatutory != null && diff != null ? (
                        <>
                          <p className="text-sm text-gray-500">Model baseline</p>
                          <p className="text-3xl font-bold text-primary-600 tabular-nums mb-3">
                            {formatBillions(v.modelStatutory)}
                          </p>
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 tabular-nums">
                            {diff >= 0 ? '+' : '−'}
                            {Math.abs(diff * 100).toFixed(1)}% vs. actual
                          </span>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 mt-1">
                          Model years begin in 2024; shown for trend context.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-primary-50 border border-primary-100 rounded-lg p-5 mt-4">
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  Why the headline baseline shows about $6.8 billion
                </p>
                <p className="text-sm text-gray-700">
                  The revenue estimates on the impact tab hold every employer at the flat 0.6%
                  net rate in both the baseline and the reform, so the additional-revenue figure
                  isolates the wage-base change. Actual collections run higher because they also
                  include credit-reduction surcharges &mdash; the extra 0.3 to 4.5 percentage
                  points employers pay in states carrying unpaid federal UI loans (recently
                  California, New York, and the U.S. Virgin Islands, about $1.7 billion per
                  year) &mdash; plus penalties and interest. Those surcharges end when states
                  repay their loans, so carrying them through a ten-year projection would be
                  speculative.
                </p>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                IRS figures are fiscal-year cash collections; model figures are calendar-year
                accrued liability, so timing differs slightly.
              </p>
            </section>

            {/* Key modeling choices */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Key modeling choices</h2>
              <p className="text-gray-700 mb-6">
                Two simplifications in how the model represents FUTA are large enough to shape
                the results and deserve prominence.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-5">
                  <p className="text-sm font-bold text-gray-900 mb-2">
                    Employer tax computed on worker wages
                  </p>
                  <p className="text-sm text-gray-700">
                    FUTA is levied on employers, with the wage base applying separately to each
                    employee at each employer. The model instead applies a single cap to each
                    worker&apos;s total annual wages across all jobs. Workers with multiple jobs
                    or mid-year job changes generate more taxable wage base in reality than in
                    the model, so this choice understates revenue.
                  </p>
                </div>
                <div className="bg-amber-50 border-l-4 border-amber-400 rounded-lg p-5">
                  <p className="text-sm font-bold text-gray-900 mb-2">
                    FUTA-exempt employment included
                  </p>
                  <p className="text-sm text-gray-700">
                    Government agencies and 501(c)(3) nonprofit employers are exempt from FUTA,
                    but their employees&apos; wages remain in the model&apos;s tax base &mdash;
                    roughly a sixth of U.S. employment &mdash; so this choice overstates
                    revenue.
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mt-4">
                At the current $7,000 base these two biases roughly offset, which is why the
                model baseline lands within a few percent of actual collections. At a $43,000
                base the offset is likely less complete: the multi-job effect shrinks relative to
                the much larger base, while the exempt-employment share stays roughly constant,
                so the reform estimate is somewhat high on this margin.
              </p>
            </section>

            {/* Methodology and sources */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Methodology and sources</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  <strong>Model and data.</strong> Estimates use policyengine-us{' '}
                  {MODEL_INFO.policyengineUs} with the {MODEL_INFO.dataset} (release{' '}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                    {MODEL_INFO.datasetRelease}
                  </code>
                  ), a ~57,000-household national survey dataset calibrated to more than 30,000
                  administrative targets. Future years use CBO-based economic uprating. FUTA
                  liability is computed per worker as min(gross wages, wage base) &times; 0.6%,
                  the net rate assuming every employer receives the full 5.4% credit for state
                  unemployment taxes.
                </p>
                <p>
                  <strong>Indexing.</strong> The $43,000 base applies in 2026. Later years grow
                  with the CPI-U using CBO&apos;s February 2026 projections, following the
                  convention that the prior February&apos;s index sets the year&apos;s parameter,
                  rounded to the nearest $100. The PolicyEngine web app does not expose parameter
                  indexing, so this analysis scripts the Python model directly.
                </p>
                <p>
                  <strong>Static estimate.</strong> No behavioral response is modeled. FUTA is an
                  employer-side tax; conventional scoring assumes employer payroll taxes are
                  ultimately borne by workers through lower wages, which would shrink income and
                  payroll tax bases and offset roughly 20&ndash;25% of the gross revenue gain.
                </p>
                <p>
                  <strong>State conformity.</strong> Federal law effectively requires state UI
                  taxable wage bases to be at least the FUTA base. Most states are below $43,000
                  today, so this reform would also force state UI tax base expansions. Those
                  state-side effects are not counted here.
                </p>
              </div>
              <ul className="mt-4 space-y-1 text-sm">
                {[
                  {
                    href: 'https://www.irs.gov/statistics/soi-tax-stats-collections-and-refunds-by-type-of-tax-irs-data-book-table-1',
                    text: 'IRS Data Book Table 1, Collections and refunds by type of tax (unemployment insurance line)',
                  },
                  {
                    href: 'https://www.cbo.gov/budget-options/2018/54809',
                    text: 'CBO budget option: Increase taxes that finance the federal share of the UI system (2018)',
                  },
                  {
                    href: 'https://www.congress.gov/crs-product/R44527',
                    text: 'CRS R44527, The Fundamentals of the Federal Unemployment Tax (FUTA)',
                  },
                  {
                    href: 'https://www.irs.gov/pub/irs-pdf/i940.pdf',
                    text: 'IRS, Instructions for Form 940',
                  },
                  {
                    href: 'https://oui.doleta.gov/unemploy/futa_credit.asp',
                    text: 'U.S. Department of Labor, FUTA credit reductions',
                  },
                ].map(({ href, text }) => (
                  <li key={href}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 underline"
                    >
                      {text}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
