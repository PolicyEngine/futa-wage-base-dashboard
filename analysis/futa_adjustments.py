"""Size the dashboard's two simplifications from the raw CPS ASEC.

The dashboard computes FUTA revenue as sum_i weight_i * 0.6% * min(wages_i, B),
which (a) applies one wage base per worker rather than one per employer and
(b) keeps wages at FUTA-exempt employers in the base. The certified Microcosm
file keeps each person's CPS identifier (PERIDNUM) and income year
(source_year), so the raw ASEC fields that describe employers can be joined
back onto the calibrated weights and uprated wages:

* PHMEMPRS  employers last year (1, 2, 3 = three or more; simultaneous jobs
            count as one employer)
* ERN_VAL   earnings from the longest job, with ERN_SRCE = 1 for wage and salary
* WS_VAL    wage and salary earnings from other employers
* WSAL_VAL  total wage and salary (ERN_VAL if ERN_SRCE = 1, plus WS_VAL)
* LJCW      class of worker on the longest job (private, federal, state, local,
            self-employed, without pay); no nonprofit split
* PEIO1COW  class of worker on the March reference-week job, which separates
            private nonprofit from private for-profit

(Definitions: Census, CPS ASEC 2024 public-use data dictionary.)

Method. Each modeled worker's wages are split between the longest-job employer
and other employers in the proportions the raw ASEC reports for that person.
Per-employer taxable wages at base B are min(longest, B) plus the other-employer
wages capped per employer, under two readings of how those wages divide:

* ``one_other``: all other-employer wages come from one employer (fewest
  employers consistent with the data; smallest per-employer effect);
* ``even_split``: they divide evenly across PHMEMPRS - 1 employers, counting
  "three or more" as three (largest effect for the reported employer count).

The two readings differ by under 1% of revenue at the $7,000 base and under
0.2% at $43,000, so the page reports ``even_split`` only.

Exempt employers. A worker's wages are treated as FUTA-exempt when the longest
job is in federal, state or local government (LJCW 2-4), or when the longest
job is private (LJCW 1) and the March job is private nonprofit (PEIO1COW 5).
Private workers with no March private job to classify get the nonprofit share
observed among classified private workers in the same income year, applied as
a probability. CPS "private nonprofit" is broader than 501(c)(3), and railroad,
tribal, small-farm and household employers cannot be identified, so this is an
approximation in both directions.

Outputs analysis/futa_adjustments.json. Requires the raw ASEC archives
(downloaded to data/asec on first run, about 150 MB each) and the same
policyengine environment as futa_wage_base.py.
"""

from __future__ import annotations

import importlib.metadata as md
import io
import json
import os
import urllib.request
import zipfile

import numpy as np
import pandas as pd
import policyengine as pe

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
ASEC_DIR = os.path.join(ROOT, "data", "asec")
OUT = os.path.join(HERE, "futa_adjustments.json")
FRONTEND_OUT = os.path.join(ROOT, "frontend", "lib", "adjustments.json")
RESULTS = os.path.join(HERE, "futa_results.json")

CURRENT_BASE = 7_000
FLAT_RATE = 0.006
ASEC_COLUMNS = [
    "PERIDNUM",
    "MARSUPWT",
    "PHMEMPRS",
    "LJCW",
    "PEIO1COW",
    "ERN_SRCE",
    "ERN_VAL",
    "WS_VAL",
    "WSAL_VAL",
]
IRS_GROSS = {2024: 8_130_484_000, 2025: 8_776_869_000}
# IRS Publication 6961 (Rev. 9-2025), Table 2: Forms W-2 filed in calendar
# year 2024 (actual). https://www.irs.gov/pub/irs-pdf/p6961.pdf
IRS_W2_FORMS_FILED_2024 = 275_028_211


def asec_person_file(survey_year: int) -> pd.DataFrame:
    yy = str(survey_year)[-2:]
    name = f"asecpub{yy}csv.zip"
    path = os.path.join(ASEC_DIR, name)
    if not os.path.exists(path):
        os.makedirs(ASEC_DIR, exist_ok=True)
        url = f"https://www2.census.gov/programs-surveys/cps/datasets/{survey_year}/march/{name}"
        print("downloading", url, flush=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as r, open(path, "wb") as f:
            f.write(r.read())
    with zipfile.ZipFile(path) as z:
        member = next(n for n in z.namelist() if n.lower().startswith("pppub"))
        with z.open(member) as f:
            df = pd.read_csv(
                io.TextIOWrapper(f, encoding="latin-1"),
                usecols=ASEC_COLUMNS,
                dtype={"PERIDNUM": str},
            )
    df["income_year"] = survey_year - 1
    return df


# --------------------------------------------------------------------------
# Model: calibrated weights and uprated wages
# --------------------------------------------------------------------------
sim = pe.us.managed_microsimulation()
bundle = getattr(sim, "policyengine_bundle", {})
dataset_path = bundle.get("runtime_dataset_source")
with pd.HDFStore(dataset_path, "r") as store:
    person_table = store["person"][["person_id", "PERIDNUM", "source_year"]].copy()
person_table["PERIDNUM"] = person_table["PERIDNUM"].astype(str)

income_years = sorted(int(y) for y in person_table["source_year"].unique())
asec = pd.concat([asec_person_file(y + 1) for y in income_years], ignore_index=True)
asec = asec.drop_duplicates(["income_year", "PERIDNUM"])

sim_person_id = sim.calc("person_id", period=2024).values
frame = pd.DataFrame({"person_id": sim_person_id}).merge(
    person_table, on="person_id", how="left", validate="one_to_one"
)
frame = frame.merge(
    asec,
    left_on=["source_year", "PERIDNUM"],
    right_on=["income_year", "PERIDNUM"],
    how="left",
)
matched = frame["WSAL_VAL"].notna().to_numpy()
print(f"persons {len(frame):,}; matched to raw ASEC {matched.mean():.4%}", flush=True)

raw_total = frame["WSAL_VAL"].fillna(0).to_numpy(float)
raw_long = np.where(
    frame["ERN_SRCE"].fillna(0).to_numpy() == 1, frame["ERN_VAL"].fillna(0), 0.0
)
raw_long = np.clip(raw_long.astype(float), 0, None)
raw_other = frame["WS_VAL"].fillna(0).to_numpy(float)
has_split = raw_total > 0
share_other = np.where(has_split, raw_other / np.where(has_split, raw_total, 1), 0.0)
share_other = np.clip(share_other, 0, 1)
share_long = 1 - share_other

employers = frame["PHMEMPRS"].fillna(1).to_numpy(int)
# Employers other than the longest-job employer: at least one when other-employer
# wages are reported, PHMEMPRS - 1 otherwise ("3 or more" counted as three).
other_employers = np.where(share_other > 0, np.maximum(employers - 1, 1), 0)

ljcw = frame["LJCW"].fillna(0).to_numpy(int)
cow = frame["PEIO1COW"].fillna(0).to_numpy(int)
government = np.isin(ljcw, (2, 3, 4))
private = ljcw == 1
classified_private = private & np.isin(cow, (4, 5))
nonprofit_known = private & (cow == 5)
unclassified_private = private & ~np.isin(cow, (4, 5))
state = sim.calc("state_code", period=2024, map_to="person").values
params = sim.tax_benefit_system.parameters


def capped(wages: np.ndarray, base: float, mode: str) -> np.ndarray:
    """Taxable wages per worker at wage base ``base``."""
    if mode == "single_cap":
        return np.minimum(wages, base)
    longest = wages * share_long
    other = wages * share_other
    if mode == "one_other":
        return np.minimum(longest, base) + np.minimum(other, base)
    k = np.maximum(other_employers, 1)
    return np.minimum(longest, base) + k * np.minimum(other / k, base)


def run_year(year: int, reform_base: float | None) -> dict:
    wages = sim.calc("payroll_tax_gross_wages", period=year).values.astype(float)
    weight = sim.calc("person_weight", period=year).values.astype(float)
    src = frame["source_year"].to_numpy()

    # Nonprofit probability for private workers with no classifiable March job:
    # the wage-weighted nonprofit share among classified private workers from
    # the same income year.
    exempt_prob = np.where(government | nonprofit_known, 1.0, 0.0)
    nonprofit_share = {}
    for y in income_years:
        in_year = src == y
        denom = (weight * wages * (classified_private & in_year)).sum()
        numer = (weight * wages * (nonprofit_known & in_year)).sum()
        p = float(numer / denom) if denom else 0.0
        nonprofit_share[str(y)] = p
        exempt_prob = np.where(unclassified_private & in_year, p, exempt_prob)
    covered = 1 - exempt_prob

    out: dict = {
        "year": year,
        "nonprofit_share_of_classified_private_wages": nonprofit_share,
    }
    bases = {"current": CURRENT_BASE}
    if reform_base is not None:
        bases["reform"] = reform_base
    for label, base in bases.items():
        for mode in ("single_cap", "one_other", "even_split"):
            taxable = capped(wages, base, mode)
            out[f"{label}_{mode}_all_wages"] = float(
                (weight * taxable).sum() * FLAT_RATE
            )
            out[f"{label}_{mode}_covered_wages"] = float(
                (weight * taxable * covered).sum() * FLAT_RATE
            )
        single = capped(wages, base, "single_cap")
        out[f"{label}_exempt_share_of_capped_wages"] = float(
            (weight * single * exempt_prob).sum() / (weight * single).sum()
        )
        out[f"{label}_government_share_of_capped_wages"] = float(
            (weight * single * government).sum() / (weight * single).sum()
        )

    workers = wages > 0
    out["workers"] = float((weight * workers).sum())
    out["share_of_workers_with_other_employer_wages"] = float(
        (weight * (workers & (share_other > 0))).sum() / (weight * workers).sum()
    )
    out["share_of_workers_with_two_or_more_employers"] = float(
        (weight * (workers & (employers >= 2))).sum() / (weight * workers).sum()
    )
    out["share_of_wages_from_other_employers"] = float(
        (weight * wages * share_other).sum() / (weight * wages).sum()
    )
    out["exempt_share_of_workers"] = float(
        (weight * workers * exempt_prob).sum() / (weight * workers).sum()
    )

    # Credit-reduction surcharge on the adjusted base, for the fiscal-year check.
    rates = params(
        f"{year}-01-01"
    ).gov.irs.payroll.federal_unemployment.credit_reduction_rate
    rate_by_state = {s: float(rates[s]) for s in set(state)}
    add_on = np.array([rate_by_state[s] for s in state])
    for mode in ("single_cap", "one_other", "even_split"):
        taxable = capped(wages, CURRENT_BASE, mode)
        out[f"surcharge_{mode}_all_wages"] = float((weight * taxable * add_on).sum())
        out[f"surcharge_{mode}_covered_wages"] = float(
            (weight * taxable * covered * add_on).sum()
        )
    return out


with open(RESULTS) as results_file:
    published = {r["year"]: r for r in json.load(results_file)["results"]}
rows = []
for year in sorted(published):
    base = published[year].get("wage_base")
    row = run_year(year, base)
    rows.append(row)
    check = published[year]["baseline_revenue_flat_06"]
    # Same sum as futa_wage_base.py, up to float32/float64 accumulation.
    assert abs(row["current_single_cap_all_wages"] / check - 1) < 1e-6, (
        year,
        row["current_single_cap_all_wages"],
        check,
    )
    print(
        json.dumps(
            {
                k: (round(v, 4) if isinstance(v, float) and v < 10 else v)
                for k, v in row.items()
                if not isinstance(v, dict)
            }
        ),
        flush=True,
    )

# 2023 surcharge for the fiscal-2024 comparison: 2023 rates on the 2024 wages.
w24 = sim.calc("payroll_tax_gross_wages", period=2024).values.astype(float)
wt24 = sim.calc("person_weight", period=2024).values.astype(float)
rates23 = params(
    "2023-01-01"
).gov.irs.payroll.federal_unemployment.credit_reduction_rate
add_on23 = np.array([float(rates23[s]) for s in state])
row24 = next(r for r in rows if r["year"] == 2024)
src = frame["source_year"].to_numpy()
exempt_prob24 = np.where(government | nonprofit_known, 1.0, 0.0)
for y in income_years:
    p = row24["nonprofit_share_of_classified_private_wages"][str(y)]
    exempt_prob24 = np.where(unclassified_private & (src == y), p, exempt_prob24)
surcharge_2023 = {}
for mode in ("single_cap", "one_other", "even_split"):
    taxable = capped(w24, CURRENT_BASE, mode)
    surcharge_2023[f"{mode}_all_wages"] = float((wt24 * taxable * add_on23).sum())
    surcharge_2023[f"{mode}_covered_wages"] = float(
        (wt24 * taxable * (1 - exempt_prob24) * add_on23).sum()
    )

by_year = {r["year"]: r for r in rows}
validation = []
for fy in (2024, 2025):
    entry = {"fiscal_year": fy, "irs_gross_collections": IRS_GROSS[fy]}
    for mode in ("single_cap", "one_other", "even_split"):
        for universe in ("all_wages", "covered_wages"):
            key = f"{mode}_{universe}"
            prior = (
                surcharge_2023[key]
                if fy == 2024
                else by_year[fy - 1][f"surcharge_{key}"]
            )
            model = by_year[fy][f"current_{key}"] + prior
            entry[f"model_{key}"] = model
            entry[f"gap_{key}"] = model / IRS_GROSS[fy] - 1
    validation.append(entry)

# --------------------------------------------------------------------------
# Cross-check on the full raw ASEC with Census weights (latest income year).
# Employer count and class of worker are not calibration targets, so the
# calibrated file can drift on them; the full survey at Census weights is the
# reference for those two ratios. Wage levels are the reverse: the calibrated
# file is fitted to administrative wage totals and the survey is not.
# --------------------------------------------------------------------------
latest = max(income_years)
raw = asec[asec["income_year"] == latest]
cw = raw["MARSUPWT"].to_numpy(float) / 100  # two implied decimals
rw = raw["WSAL_VAL"].to_numpy(float)
r_long = np.where(
    raw["ERN_SRCE"].to_numpy() == 1, raw["ERN_VAL"].clip(lower=0), 0.0
).astype(float)
r_other = raw["WS_VAL"].to_numpy(float)
r_emp = raw["PHMEMPRS"].to_numpy(int)
r_k = np.where(r_other > 0, np.maximum(r_emp - 1, 1), 1)
r_gov = raw["LJCW"].isin([2, 3, 4]).to_numpy()
r_priv = (raw["LJCW"] == 1).to_numpy()
r_np = r_priv & (raw["PEIO1COW"] == 5).to_numpy()
r_cls = r_priv & raw["PEIO1COW"].isin([4, 5]).to_numpy()
r_p = float((cw * rw * r_np).sum() / (cw * rw * r_cls).sum())
r_exempt = np.where(r_gov | r_np, 1.0, np.where(r_priv & ~r_cls, r_p, 0.0))
earners = rw > 0
census = {
    "income_year": latest,
    "wage_earners": float(cw[earners].sum()),
    "total_wages": float((cw * rw).sum()),
    "share_with_two_or_more_employers": float(
        (cw * (earners & (r_emp >= 2))).sum() / cw[earners].sum()
    ),
    "share_with_three_or_more_employers": float(
        (cw * (earners & (r_emp >= 3))).sum() / cw[earners].sum()
    ),
}
for label, base in (
    ("current", CURRENT_BASE),
    ("reform_2026", published[2026]["wage_base"]),
):
    single = np.minimum(rw, base)
    per_employer = np.minimum(r_long, base) + r_k * np.minimum(r_other / r_k, base)
    census[f"{label}_single_cap_revenue"] = float((cw * single).sum() * FLAT_RATE)
    census[f"{label}_per_employer_uplift"] = float(
        (cw * per_employer).sum() / (cw * single).sum() - 1
    )
    census[f"{label}_exempt_share_of_capped_wages"] = float(
        (cw * single * r_exempt).sum() / (cw * single).sum()
    )
s_add = census  # readability below
s_add["additional_per_employer_uplift"] = float(
    (
        (1 + census["reform_2026_per_employer_uplift"])
        * census["reform_2026_single_cap_revenue"]
        - (1 + census["current_per_employer_uplift"])
        * census["current_single_cap_revenue"]
    )
    / (census["reform_2026_single_cap_revenue"] - census["current_single_cap_revenue"])
    - 1
)
# Microcosm at the same base and year, for the wage-level comparison.
w_latest = sim.calc("payroll_tax_gross_wages", period=latest).values.astype(float)
wt_latest = sim.calc("person_weight", period=latest).values.astype(float)
census["mean_employers_per_wage_earner"] = float(
    (cw[earners] * np.clip(r_emp[earners], 1, None)).sum() / cw[earners].sum()
)
census["microcosm_same_year"] = {
    "wage_earners": float((wt_latest * (w_latest > 0)).sum()),
    "total_wages": float((wt_latest * w_latest).sum()),
    "current_single_cap_revenue": float(
        (wt_latest * np.minimum(w_latest, CURRENT_BASE)).sum() * FLAT_RATE
    ),
    "reform_2026_single_cap_revenue": float(
        (wt_latest * np.minimum(w_latest, published[2026]["wage_base"])).sum()
        * FLAT_RATE
    ),
    "share_with_two_or_more_employers": float(
        (wt_latest * ((w_latest > 0) & (employers >= 2))).sum()
        / (wt_latest * (w_latest > 0)).sum()
    ),
}

output = {
    "policyengine_version": md.version("policyengine"),
    "policyengine_us_version": md.version("policyengine-us"),
    "dataset_build": bundle.get("certified_data_build_id"),
    "asec_survey_years": [y + 1 for y in income_years],
    "asec_match_rate": float(matched.mean()),
    "results": rows,
    "surcharge_2023_on_2024_wages": surcharge_2023,
    "validation": validation,
    "raw_asec_census_weights": census,
    "irs_w2_forms_filed_2024": IRS_W2_FORMS_FILED_2024,
}
for path in (OUT, FRONTEND_OUT):
    with open(path, "w") as f:
        json.dump(output, f, indent=2)
        f.write("\n")
    print("wrote", path, flush=True)


# The dashboard's CSV: the adjusted (headline) series first, the unadjusted
# model output second. Must stay byte-identical to frontend buildCsv().
def _round(x: float) -> int:
    """Math.round semantics for the non-negative values written here."""
    return int(x + 0.5)


csv_out = os.path.join(HERE, "futa_wage_base_estimates.csv")
with open(csv_out, "w", newline="") as f:
    f.write(
        "calendar_year,taxable_wage_base_usd,cpi_u_prior_year_average,"
        "adjusted_baseline_revenue_usd,adjusted_reform_revenue_usd,"
        "adjusted_additional_revenue_usd,"
        "unadjusted_baseline_revenue_usd,unadjusted_reform_revenue_usd,"
        "unadjusted_additional_revenue_usd,workers_with_wages,"
        "workers_with_wages_above_7000\n"
    )
    for year in sorted(y for y in published if published[y].get("wage_base")):
        p = published[year]
        a = by_year[year]
        adj_base = a["current_even_split_covered_wages"]
        adj_reform = a["reform_even_split_covered_wages"]
        f.write(
            f"{year},{p['wage_base']},{p['cpi_u_prior_year_average']:.3f},"
            f"{_round(adj_base)},{_round(adj_reform)},{_round(adj_reform - adj_base)},"
            f"{_round(p['baseline_revenue_flat_06'])},"
            f"{_round(p['reform_revenue_flat_06'])},"
            f"{_round(p['additional_revenue_flat_06'])},"
            f"{_round(p['workers_with_wages'])},"
            f"{_round(p['workers_above_current_base'])}\n"
        )
print("wrote", csv_out, flush=True)
