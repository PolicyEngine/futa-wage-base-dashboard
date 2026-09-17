# FUTA taxable wage base dashboard

Estimates the FUTA revenue from raising the federal unemployment taxable wage base from $7,000 to $43,000 in 2026 and indexing it to the CPI-U thereafter, holding the 6.0% statutory rate and the maximum 5.4% state-tax credit (0.6% net) constant. The $43,000 figure is roughly the 2023 median annual wage of U.S. workers ($43,222.81, [SSA net compensation statistics](https://www.ssa.gov/cgi-bin/netcomp.cgi?year=2023)).

**Live:** https://policyengine.org/us/futa-wage-base-dashboard (also served at https://futa-wage-base-dashboard.vercel.app/us/futa-wage-base-dashboard)

## Results

All figures are calendar years, flat 0.6% net rate, no behavioral response, FUTA line only (state unemployment taxes, which federal law would also raise, are not counted). The headline series adjusts the model output for its two measured simplifications (below); the unadjusted model output is shown alongside it and in the CSV.

- 2026: +$20.8 billion (adjusted; $26.4 billion unadjusted)
- 2026 to 2035: $251.1 billion (adjusted; $317.4 billion unadjusted)
- Wage base path: $43,000 (2026) to $53,200 (2035), CPI-U indexed, rounded to the nearest $100

The two simplifications: wages at FUTA-exempt employers (government, 501(c)(3) nonprofits, and others) stay in the model's base, and the wage base is applied once per worker rather than once per employer. `analysis/futa_adjustments.py` measures both by joining raw CPS ASEC employer fields (class of worker, employers last year, wages from other employers) to the model's persons by CPS person id, and the headline applies both adjustments. Exempt employers hold 22.7% of wages under the $43,000 base; removing them lowers the 2026 gain from $26.4 billion to $20.4 billion. Per-employer capping, as the CPS reports employers, raises the gain by 1% to 2%. The same adjustments put the model 17% below IRS collections, so the unadjusted model's closeness to collections reflects offsetting errors; the CPS reports 1.13 employers per wage earner against about 1.6 Forms W-2 per wage earner in IRS counts.

## Method

Computed with [policyengine-us](https://github.com/PolicyEngine/policyengine-us) 2.2.1 through the [policyengine](https://github.com/PolicyEngine/policyengine.py) package (6.0.0), which pins the certified Microcosm US 2024 national dataset (`populace-us-2024-spm-20260915`, about 57,000 households, 50 states plus DC). FUTA liability is linear in the wage base, so each year needs one baseline simulation: revenue = Σ weight × min(gross wages, base) × 0.6%.

Indexing: for each year after 2026 the base is $43,000 × (prior calendar-year average CPI-U) / (2025 average), rounded to the nearest $100. The CPI-U series is the model's parameter: BLS monthly values through the latest release, CBO February 2026 calendar-year projections after that, with the rest of the current year interpolated between the two.

Validation: the dashboard compares the model with IRS Data Book gross FUTA collections on a fiscal-year basis (base tax for the year plus the prior year's credit-reduction surcharge, which employers pay with the fourth-quarter deposit the following January). The model runs 3.6% below IRS in fiscal 2024 and 3.2% below in fiscal 2025.

The script, its unedited output, and the CSV live in [`analysis/`](analysis/). The dashboard reads `frontend/lib/results.json`, a copy of `analysis/futa_results.json`; tests fail if the two differ or if the CSV drifts from them.

### Reproducing

```bash
uv venv .venv && source .venv/bin/activate
uv pip install "policyengine[us]==6.0.0"
python analysis/futa_wage_base.py
```

The first run downloads the certified dataset (about 830 MB) into `data/`. The script writes `analysis/futa_results.json`, `analysis/futa_wage_base_estimates.csv`, and `frontend/lib/results.json`.

```bash
python analysis/futa_adjustments.py
```

Downloads the 2023 to 2025 CPS ASEC public-use files from Census (about 150 MB each) into `data/asec/` and writes `analysis/futa_adjustments.json` and `frontend/lib/adjustments.json`.

### CSV columns

| Column | Meaning |
|---|---|
| `calendar_year` | Tax year of the simulation |
| `taxable_wage_base_usd` | FUTA wage base under the reform |
| `cpi_u_prior_year_average` | Calendar-year average CPI-U for the prior year that set the base |
| `adjusted_baseline_revenue_usd` | FUTA revenue at the $7,000 base, 0.6% net rate, both adjustments applied |
| `adjusted_reform_revenue_usd` | FUTA revenue at the reform base, 0.6% net rate, both adjustments applied |
| `adjusted_additional_revenue_usd` | Reform minus baseline (adjusted; the headline series) |
| `unadjusted_baseline_revenue_usd` | Model output before the adjustments |
| `unadjusted_reform_revenue_usd` | Model output before the adjustments |
| `unadjusted_additional_revenue_usd` | Model output before the adjustments |
| `workers_with_wages` | People with any modeled wages in the year |
| `workers_with_wages_above_7000` | People with modeled wages above $7,000 |

## Development

```bash
cd frontend
bun install
NEXT_PUBLIC_BASE_PATH="" bun run dev
```

`bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build` run in CI on every pull request.

Production serves under the `/us/futa-wage-base-dashboard` base path for the policyengine.org multi-zone setup. `NEXT_PUBLIC_SITE_URL` (set in Vercel to the policyengine.org mount) drives the canonical, share and sitemap URLs; without it they derive from the Vercel production URL.

## Deploy

Vercel deploys `main` automatically (project root: `frontend/`).
