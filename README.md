# FUTA taxable wage base dashboard

Estimates the federal revenue from raising the FUTA taxable wage base from $7,000 to $43,000 in 2026 and indexing it to the CPI-U thereafter, holding the 6.0% statutory rate and maximum 5.4% state-tax credit (0.6% net) constant.

**Live:** https://futa-wage-base-dashboard.vercel.app/us/futa-wage-base-dashboard

## Results

- +$26.4 billion in additional federal revenue in 2026 (baseline $6.8B → $33.3B)
- $318.8 billion over 2026–2035 (static)
- Wage base path: $43,000 (2026) → $53,600 (2035), CPI-U indexed, rounded to the nearest $100

## Method

Computed with [policyengine-us](https://github.com/PolicyEngine/policyengine-us) 1.808.0 (including the credit-reduction rate corrections merged in [PR #9326](https://github.com/PolicyEngine/policyengine-us/pull/9326)) on the Microcosm US 2024 national dataset (Build P). FUTA liability is linear in the wage base, so each year needs only one baseline simulation: revenue = Σ weight × min(gross wages, base) × 0.6%. The calculation script and its raw output live in [`analysis/`](analysis/); the resulting estimates are embedded in `frontend/lib/data.ts`, so the dashboard itself is fully static.

Benchmarked against actual FUTA collections from IRS Data Book Table 1 ($7.9B FY2023, $8.1B FY2024, $8.8B FY2025). The dashboard baseline (~$7B) excludes credit-reduction surcharges from states with outstanding federal UI loans by design; see the methodology section on the dashboard.

## Development

```bash
cd frontend
npm install
NEXT_PUBLIC_BASE_PATH="" npm run dev
```

Production serves under the `/us/futa-wage-base-dashboard` base path for the policyengine.org multi-zone setup.

## Deploy

```bash
cd frontend
vercel deploy --prod --scope policy-engine --yes
```
