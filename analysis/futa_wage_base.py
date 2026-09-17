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
  These are the dashboard's headline numbers, computed for every year.
* ``*_statutory``: each state's credit-reduction add-on for that tax year is
  applied on top of 0.6%. Computed only for the benchmark years, where it
  feeds the validation tab's comparison with IRS collections. The dataset
  covers the 50 states and DC, so only California and New York surcharges
  appear (the Virgin Islands and Puerto Rico are not in the data).

Validation alignment. IRS Data Book collections are federal fiscal-year cash.
Employers deposit the base tax quarterly, and pay a tax year's
credit-reduction add-on with the fourth-quarter deposit due January 31 of the
following year, so fiscal year t holds roughly the base tax for calendar year
t plus the surcharge for calendar year t-1. The ``fiscal_year_model`` series
is built the same way: ``flat_06[t] + surcharge[t-1]``.

Indexing. The $43,000 base applies in 2026. For year Y > 2026 the base is
43,000 x (CPI-U calendar-year average for Y-1) / (CPI-U calendar-year average
for 2025), rounded to the nearest $100. The CPI-U series is the model's
``gov.bls.cpi.cpi_u`` parameter: BLS monthly values through the latest
release, then CBO's calendar-year projections (stored at February instants,
annotated with the tax year they set). Months of the current year without a
BLS value are interpolated geometrically between the last observation and
CBO's next calendar-year average. Only the current year needs this; every
later year uses a CBO calendar-year average directly.

Environment: the ``policyengine`` package (policyengine.py) resolves the
certified dataset for its bundled policyengine-us release, so the run is
reproducible from the pinned versions written into the output JSON.

    uv pip install "policyengine[us]==6.0.0"
    python analysis/futa_wage_base.py
"""

from __future__ import annotations

import importlib.metadata as md
import json
import math
import os
from datetime import date

import policyengine as pe

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "futa_results.json")
CSV_OUT = os.path.join(HERE, "futa_wage_base_estimates.csv")
FRONTEND_OUT = os.path.join(HERE, "..", "frontend", "lib", "results.json")

CURRENT_BASE = 7_000
NEW_BASE = 43_000
FLAT_RATE = 0.006
START_YEAR = 2026
END_YEAR = 2035
YEARS = list(range(START_YEAR, END_YEAR + 1))
# Benchmark years: statutory credit-reduction rates applied, for the
# validation tab. 2023 supplies the surcharge that lands in fiscal 2024 cash.
BENCH_YEARS = [2023, 2024, 2025]

# IRS Data Book Table 1 / Table 1-1, "Unemployment insurance" line, gross
# collections (thousands of dollars in the source). Footnote 1: gross
# collections include penalties and interest. FY2025 file: 25db-1-01-co.xlsx;
# FY2024: 24dbs01t01co.xlsx; FY2023: 23dbs01t01co.xlsx.
IRS_GROSS = {2023: 7_946_725_000, 2024: 8_130_484_000, 2025: 8_776_869_000}
IRS_REFUNDS = {2023: 162_062_000, 2024: 133_603_000, 2025: 148_702_000}

sim = pe.us.managed_microsimulation()
bundle = getattr(sim, "policyengine_bundle", {})
params = sim.tax_benefit_system.parameters
cpi_u = params.gov.bls.cpi.cpi_u

print("policyengine", md.version("policyengine"), flush=True)
print("policyengine-us", md.version("policyengine-us"), flush=True)
print("bundle", json.dumps(bundle, default=str)[:600], flush=True)


# --------------------------------------------------------------------------
# CPI-U: calendar-year averages from the model's parameter series.
# --------------------------------------------------------------------------
def _instants() -> dict[date, float]:
    out = {}
    for v in cpi_u.values_list:
        y, m, d = (int(x) for x in v.instant_str.split("-"))
        out[date(y, m, d)] = float(v.value)
    return out


INSTANTS = _instants()
# The last observed BLS month. February instants can hold CBO projections,
# so only non-February instants mark the end of the observed series (the
# same rule policyengine-us uses in uprating_extensions.py).
LAST_OBSERVED = max(d for d in INSTANTS if d.month != 2)
# CBO calendar-year averages: February instants after the last observation,
# stored under the following tax year. "2027-02-01: 340.3 # 2028 value" is
# CBO's calendar-2027 average, so key it by its own calendar year.
CBO_CY_AVG = {
    d.year: v for d, v in INSTANTS.items() if d.month == 2 and d > LAST_OBSERVED
}


def observed(year: int, month: int) -> float | None:
    d = date(year, month, 1)
    if d > LAST_OBSERVED:
        return None
    # Missing months (October 2025 was not published) carry the prior value,
    # which is how the parameter series itself resolves them.
    return float(cpi_u(f"{year}-{month:02d}-01"))


def cy_average(year: int) -> tuple[float, str]:
    """Calendar-year average CPI-U and how it was obtained."""
    if year in CBO_CY_AVG and year > LAST_OBSERVED.year:
        return CBO_CY_AVG[year], "cbo_calendar_year_projection"
    months = [observed(year, m) for m in range(1, 13)]
    if all(v is not None for v in months):
        return sum(months) / 12, "bls_observed"
    # Partial year: interpolate geometrically from the last observation to
    # CBO's next calendar-year average, placed at 1 July of that year.
    n_obs = sum(v is not None for v in months)
    last = observed(LAST_OBSERVED.year, LAST_OBSERVED.month)
    next_year = min(y for y in CBO_CY_AVG if y > year)
    target = CBO_CY_AVG[next_year]
    months_to_target = (next_year - LAST_OBSERVED.year) * 12 + (7 - LAST_OBSERVED.month)
    monthly_growth = (target / last) ** (1 / months_to_target)
    filled = []
    for m in range(1, 13):
        v = months[m - 1]
        if v is None:
            steps = (year - LAST_OBSERVED.year) * 12 + (m - LAST_OBSERVED.month)
            v = last * monthly_growth**steps
        filled.append(v)
    return sum(filled) / 12, f"bls_observed_{n_obs}_months_plus_interpolation"


CPI_REF_YEAR = START_YEAR - 1
CPI_REF, CPI_REF_SOURCE = cy_average(CPI_REF_YEAR)


def indexed_base(year: int) -> tuple[int, float, str]:
    if year <= START_YEAR:
        return NEW_BASE, CPI_REF, CPI_REF_SOURCE
    avg, source = cy_average(year - 1)
    raw = NEW_BASE * avg / CPI_REF
    return int(round(raw / 100) * 100), avg, source


# --------------------------------------------------------------------------
# Simulation
# --------------------------------------------------------------------------
def weighted_population(year: int) -> float:
    # .values avoids MicroSeries weighting the weights themselves.
    return float(sim.calc("person_weight", period=year).values.sum())


DATASET_YEAR = 2024
rows: dict[int, dict] = {}
approximations: dict[str, dict] = {}
for year in sorted(set(BENCH_YEARS + YEARS)):
    pop = weighted_population(year)
    if year < DATASET_YEAR and pop < 0.5 * weighted_population(DATASET_YEAR):
        # The certified file is a single-period 2024 artifact: weights are
        # undefined before 2024, so a 2023 run returns an empty population.
        # Approximate that year's surcharge by applying its statutory
        # credit-reduction rates to the 2024 wage distribution.
        wages = sim.calc("payroll_tax_gross_wages", period=DATASET_YEAR)
        state = sim.calc("state_code", period=DATASET_YEAR, map_to="person").values
        rates = params(
            f"{year}-01-01"
        ).gov.irs.payroll.federal_unemployment.credit_reduction_rate
        rate_by_state = {s: float(rates[s]) for s in set(state)}
        add_on = wages.clip(upper=CURRENT_BASE) * [rate_by_state[s] for s in state]
        approximations[str(year)] = {
            "year": year,
            "credit_reduction_surcharge": float(add_on.sum()),
            "basis": (
                f"{year} statutory credit-reduction rates applied to the "
                f"{DATASET_YEAR} wage distribution (the dataset has no {year} weights)"
            ),
            "states_with_rates": sorted(s for s, r in rate_by_state.items() if r > 0),
        }
        print(json.dumps(approximations[str(year)]), flush=True)
        continue
    wages = sim.calc("payroll_tax_gross_wages", period=year)
    row = {
        "year": year,
        "weighted_persons": pop,
        "baseline_revenue_flat_06": float(
            (wages.clip(upper=CURRENT_BASE) * FLAT_RATE).sum()
        ),
        "workers_with_wages": float(((wages > 0) * 1.0).sum()),
        "workers_above_current_base": float(((wages > CURRENT_BASE) * 1.0).sum()),
    }
    if year in BENCH_YEARS:
        rate = sim.calc("employer_federal_unemployment_tax_rate", period=year)
        statutory = float((wages.clip(upper=CURRENT_BASE) * rate).sum())
        # Should equal the model's own FUTA variable; confirms the formula.
        model_check = float(
            sim.calc("employer_federal_unemployment_tax", period=year).sum()
        )
        row.update(
            {
                "baseline_revenue_statutory": statutory,
                "model_futa_variable_check": model_check,
                "credit_reduction_surcharge": statutory
                - row["baseline_revenue_flat_06"],
            }
        )
    if year in YEARS:
        base, cpi_avg, cpi_source = indexed_base(year)
        reform = float((wages.clip(upper=base) * FLAT_RATE).sum())
        row.update(
            {
                "wage_base": base,
                "cpi_u_prior_year_average": cpi_avg,
                "cpi_u_source": cpi_source,
                "reform_revenue_flat_06": reform,
                "additional_revenue_flat_06": reform - row["baseline_revenue_flat_06"],
            }
        )
    rows[year] = row
    print(json.dumps(row), flush=True)

# Fiscal-year alignment for the validation tab.
validation = []
for fy in (2024, 2025):
    prior = rows.get(fy - 1)
    if prior is not None and "credit_reduction_surcharge" in prior:
        surcharge_prior = prior["credit_reduction_surcharge"]
        basis = "modeled"
    elif str(fy - 1) in approximations:
        surcharge_prior = approximations[str(fy - 1)]["credit_reduction_surcharge"]
        basis = approximations[str(fy - 1)]["basis"]
    else:
        continue
    model_fy = rows[fy]["baseline_revenue_flat_06"] + surcharge_prior
    validation.append(
        {
            "fiscal_year": fy,
            "irs_gross_collections": IRS_GROSS[fy],
            "irs_refunds": IRS_REFUNDS[fy],
            "model_fiscal_year_basis": model_fy,
            "model_flat_06_calendar_year": rows[fy]["baseline_revenue_flat_06"],
            "model_surcharge_prior_calendar_year": surcharge_prior,
            "model_surcharge_prior_calendar_year_basis": basis,
            "model_statutory_same_calendar_year": rows[fy].get(
                "baseline_revenue_statutory"
            ),
        }
    )

output = {
    "generated": date.today().isoformat(),
    "policyengine_version": md.version("policyengine"),
    "policyengine_us_version": md.version("policyengine-us"),
    "bundle": bundle,
    "cpi_u_reference": {
        "calendar_year": CPI_REF_YEAR,
        "average": CPI_REF,
        "source": CPI_REF_SOURCE,
        "last_observed_month": LAST_OBSERVED.isoformat(),
    },
    "results": [rows[y] for y in sorted(rows)],
    "surcharge_approximations": approximations,
    "validation": validation,
}


def _jsonable(o):
    if isinstance(o, dict):
        return {k: _jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_jsonable(v) for v in o]
    if isinstance(o, float) and (math.isnan(o) or math.isinf(o)):
        return None
    if isinstance(o, (str, int, float, bool)) or o is None:
        return o
    return str(o)


output = _jsonable(output)
with open(OUT, "w") as f:
    json.dump(output, f, indent=2)
    f.write("\n")
print("wrote", OUT, flush=True)

# Frontend copy: the dashboard reads this file; a test checks it matches OUT.
os.makedirs(os.path.dirname(FRONTEND_OUT), exist_ok=True)
with open(FRONTEND_OUT, "w") as f:
    json.dump(output, f, indent=2)
    f.write("\n")
print("wrote", FRONTEND_OUT, flush=True)

# CSV matching the dashboard's download: one row per projection year.
with open(CSV_OUT, "w", newline="") as f:
    f.write(
        "calendar_year,taxable_wage_base_usd,cpi_u_prior_year_average,"
        "baseline_revenue_usd,reform_revenue_usd,additional_revenue_usd,"
        "workers_with_wages,workers_with_wages_above_7000\n"
    )
    for y in YEARS:
        r = rows[y]
        f.write(
            f"{y},{r['wage_base']},{r['cpi_u_prior_year_average']:.3f},"
            f"{r['baseline_revenue_flat_06']:.0f},{r['reform_revenue_flat_06']:.0f},"
            f"{r['additional_revenue_flat_06']:.0f},{r['workers_with_wages']:.0f},"
            f"{r['workers_above_current_base']:.0f}\n"
        )
print("wrote", CSV_OUT, flush=True)
