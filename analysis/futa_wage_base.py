"""FUTA taxable wage base reform: $7,000 -> $43,000 in 2026, indexed to the CPI-U.

Computes the revenue series behind the FUTA wage base dashboard
(https://github.com/PolicyEngine/futa-wage-base-dashboard).

FUTA liability is linear in the taxable wage base, so each year needs only
one baseline microsimulation. For a scenario with wage base B,

    revenue = sum_i weight_i * rate_i * min(wages_i, B)

with wages taken from the person-level ``payroll_tax_gross_wages`` variable.

Two rate conventions appear in the output:

* ``*_flat_06``: every employer pays the flat 0.6% net rate (full 5.4%
  credit for state unemployment taxes, no credit-reduction surcharges).
  These are the dashboard's headline numbers.
* ``baseline_revenue`` / ``reform_revenue``: each state's statutory
  credit-reduction add-on is applied on top of 0.6%. This series feeds the
  validation tab's comparison against IRS actual collections, and requires
  a policyengine-us release that includes PR #9326 (merged 2026-08-24),
  which corrected stale credit-reduction rates for seven states.

Dataset: Microcosm US 2024 national (Build P sparse release), pinned by
revision below and downloaded from Hugging Face on first run.
"""

import importlib.metadata as md
import json
import os

from huggingface_hub import hf_hub_download
from policyengine_us import Microsimulation

DATASET_REPO = "policyengine/populace-us"
DATASET_REVISION = "populace-us-2024-buildp-sparse-rmloss100-cae8640-20260728T011454Z"
DATASET_FILE = "populace_us_2024.h5"

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "futa_results.json")
CSV_OUT = os.path.join(HERE, "futa_wage_base_estimates.csv")

CURRENT_BASE = 7_000
NEW_BASE = 43_000
START_YEAR = 2026
YEARS = list(range(START_YEAR, 2036))
# Benchmark years overlapping IRS Data Book actuals (validation tab).
BENCH_YEARS = [2024, 2025]

dataset_path = hf_hub_download(
    repo_id=DATASET_REPO,
    repo_type="dataset",
    filename=DATASET_FILE,
    revision=DATASET_REVISION,
)
print("policyengine-us", md.version("policyengine-us"), flush=True)
print("dataset", dataset_path, flush=True)

sim = Microsimulation(dataset=dataset_path)
params = sim.tax_benefit_system.parameters
cpi_u = params.gov.bls.cpi.cpi_u  # CBO February 2026 projections

# Parameter-file convention: the February index of year y-1 sets the
# tax-year-y value (e.g. the 2027-02-01 entry is annotated "# 2028 value").
ref_index = cpi_u(f"{START_YEAR - 1}-02-01")


def indexed_base(year: int) -> int:
    """Wage base for a given year: $43,000 in 2026, then CPI-U indexed,
    rounded to the nearest $100."""
    if year <= START_YEAR:
        return NEW_BASE
    raw = NEW_BASE * cpi_u(f"{year - 1}-02-01") / ref_index
    return int(round(raw / 100) * 100)


results = []
for year in BENCH_YEARS + YEARS:
    wages = sim.calc("payroll_tax_gross_wages", period=year)
    rate = sim.calc("employer_federal_unemployment_tax_rate", period=year)

    baseline_rev = (wages.clip(upper=CURRENT_BASE) * rate).sum()
    # Should equal baseline_rev; confirms the formula matches the model.
    model_check = sim.calc("employer_federal_unemployment_tax", period=year).sum()

    row = {
        "year": year,
        "baseline_revenue": float(baseline_rev),
        "model_futa_variable_check": float(model_check),
    }

    if year in YEARS:
        base = indexed_base(year)
        row["cpi_u_index"] = float(cpi_u(f"{year - 1}-02-01"))
        reform_rev = (wages.clip(upper=base) * rate).sum()
        baseline_flat = (wages.clip(upper=CURRENT_BASE) * 0.006).sum()
        reform_flat = (wages.clip(upper=base) * 0.006).sum()
        affected = ((wages > CURRENT_BASE) * 1.0).sum()
        workers = ((wages > 0) * 1.0).sum()
        row.update(
            {
                "wage_base": base,
                "reform_revenue": float(reform_rev),
                "additional_revenue": float(reform_rev - baseline_rev),
                "baseline_revenue_flat_06": float(baseline_flat),
                "reform_revenue_flat_06": float(reform_flat),
                "additional_revenue_flat_06": float(reform_flat - baseline_flat),
                "workers_above_current_base": float(affected),
                "workers_with_wages": float(workers),
            }
        )
    else:
        row["baseline_revenue_flat_06"] = float(
            (wages.clip(upper=CURRENT_BASE) * 0.006).sum()
        )

    results.append(row)
    print(json.dumps(row), flush=True)

with open(OUT, "w") as f:
    json.dump(
        {
            "policyengine_us_version": md.version("policyengine-us"),
            "dataset": f"{DATASET_REPO} @ {DATASET_REVISION}",
            "results": results,
        },
        f,
        indent=2,
    )
print("wrote", OUT, flush=True)

# CSV matching the dashboard's download: one row per year, flat-0.6% basis.
with open(CSV_OUT, "w", newline="") as f:
    f.write(
        "year,taxable_wage_base_usd,cpi_u_index,baseline_revenue_usd,"
        "reform_revenue_usd,additional_revenue_usd,workers_above_7000\n"
    )
    for r in results:
        if "wage_base" not in r:
            continue
        f.write(
            f"{r['year']},{r['wage_base']},{r['cpi_u_index']:.1f},"
            f"{r['baseline_revenue_flat_06']:.0f},{r['reform_revenue_flat_06']:.0f},"
            f"{r['additional_revenue_flat_06']:.0f},{r['workers_above_current_base']:.0f}\n"
        )
print("wrote", CSV_OUT, flush=True)
