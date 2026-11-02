"""Extracts the HOLSEA sea-level database and samples the GIA models at its indicators (V-03).

    python tools/data/rsl_validation.py

Writes tools/validate/data/rsl-observations.json — the input of the quantitative validation. The
statistics themselves are computed in TypeScript (tools/validate/rsl.ts), where the registry lives;
this step does the part that needs Python: an .xlsx workbook and nineteen NetCDF fields.

## What is compared, and why no datum transformation is needed

The database records, per indicator, the **relative sea level** at a place and time — metres of the
contemporaneous sea surface against today's local mean sea level. The Steffen & Kaufmann field
records the same quantity on the same convention (`RSL`, metres relative to 1950, positive = sea
higher than today). So this is RSL against RSL and needs no transformation.

That is worth saying explicitly, because `V-03`'s issue warns about one: comparing the *paleo-DEM*
against these observations would need the `contemporaneous-geoid` ↔ today transformation of `0-07`,
since H_paleo is referenced to the geoid of its own time. Validating the RSL field directly avoids
the step where §0.1 and §0.2 go wrong — eustasy counted twice, or a confused datum — rather than
performing it and hoping.

## The 1 099 indicators

The workbook's `Short-form` sheet holds 11 399 rows, of which 204 are flagged rejected by the
authors and about ten thousand are padding — every numeric cell zero, including the position.
Dropping the rejected rows and the ones whose position is not inside the database's own region
leaves exactly **1 099**, the figure the plan and the issue both quote, so the filter reproduces
the authors' notion of a usable indicator rather than inventing a threshold. `EXPECTED_INDICATORS`
asserts that count: if a future revision of the workbook changes it, this stops rather than
silently validating against a different database.

`Tendency` gives the cluster. Two of the plan's three are in the data as `positive` and `negative`;
the third is **not** "transitional" but `nd` — not determined — and 451 of the 1 099 carry it. They
are reported as their own group under that name, because calling a missing interpretation a
transitional one would invent a reading the database declines to make.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import openpyxl
import xarray as xr

from tools.data.postglacial import bilinear_layer, rsl_at

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "tools" / "validate" / "data"
HOLSEA = RAW / "rosentau2021" / "2020-003_Rosentau-et-al_HOLSEA_baltic_isol_21-06-18.xlsx"
MODELS = ("f75", "g76", "j88", "l79", "p79", "sk1", "sk2", "sk3")
MODEL_NC = RAW / "steffen2025_rsl" / "rsl_SK05_skan_{model}.nc"
SBALTIC = ("f52", "f67", "fb6", "ib9", "jb9", "kb6", "m71", "pb7", "pb9")
SBALTIC_NC = RAW / "steffen2025_rsl_sbaltic" / "rsl_Steffen-etal14_balticsea_{model}_ANU-ICE.nc"

# Short-form column indices, from the sheet's own header row.
COL = {"id": 0, "ref": 1, "subregion": 3, "lat": 4, "lon": 5, "age": 9,
       "age_plus": 10, "age_minus": 11, "tendency": 12, "rsl": 25,
       "rsl_plus": 26, "rsl_minus": 27, "reject": 32}
CLUSTERS = {"positive": "transgression", "negative": "regression"}
# The database's own region: everything it covers lies at 53.9–66.8 N / 9.7–30.1 E. A row outside
# it is the sheet's padding (all-zero cells, so a position of 0 N 0 E), not an indicator.
REGION = (5.0, 50.0, 35.0, 70.0)
EXPECTED_INDICATORS = 1099


def _num(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(f) else f


def read_indicators() -> list[dict]:
    ws = openpyxl.load_workbook(HOLSEA, read_only=True, data_only=True)["Short-form"]
    out: list[dict] = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        if str(row[COL["reject"]]).strip() not in ("0", "0.0"):
            continue
        lat, lon, age, rsl = (_num(row[COL[k]]) for k in ("lat", "lon", "age", "rsl"))
        if None in (lat, lon, age, rsl):
            continue
        west, south, east, north = REGION
        if not (west <= lon <= east and south <= lat <= north):
            continue
        # The 2σ bounds are asymmetric; the larger half is the honest one-number uncertainty.
        sigma = max(_num(row[COL["rsl_plus"]]) or 0.0, _num(row[COL["rsl_minus"]]) or 0.0)
        age_sigma = max(_num(row[COL["age_plus"]]) or 0.0, _num(row[COL["age_minus"]]) or 0.0)
        tendency = str(row[COL["tendency"]]).strip().lower()
        out.append({
            "id": str(row[COL["id"]]).strip(),
            # "Finland; Åland; Geta, Bredvik" — the first field is the region.
            "region": str(row[COL["subregion"]]).split(";")[0].strip(),
            "cluster": CLUSTERS.get(tendency, "undetermined"),
            "lon": round(lon, 4),
            "lat": round(lat, 4),
            "tBP": int(round(age)),
            "rslM": round(rsl, 2),
            "sigmaM": round(sigma, 2),
            "ageSigmaYr": int(round(age_sigma)),
        })
    return out


@dataclass(frozen=True)
class Field:
    """
    Just enough of a `kmdg.Grid` for the pipeline's samplers: a bbox, the times and the values.

    Deliberately *not* a KMDG grid. Quantising to int16 at 0.01 m overflows — these fields reach
    280 m at Umeå and some models further — and a published grid is not wanted here anyway: this is
    a validation input, so it keeps the source precision and goes nowhere near src/assets/data.
    """
    raw: np.ndarray
    bbox: tuple[float, float, float, float]
    times: tuple[float, ...]

    def values(self) -> np.ndarray:
        return self.raw


def grid_of(path: Path) -> Field:
    """One RSL field, oriented and georeferenced as `postglacial.build_rsl` does it."""
    ds = xr.open_dataset(path)
    rsl = ds["RSL"].transpose("time", "lat", "lon")
    lat, lon = ds["lat"].values, ds["lon"].values
    dlat, dlon = float(lat[1] - lat[0]), float(lon[1] - lon[0])
    values = rsl.values[:, ::-1, :] if dlat > 0 else rsl.values
    # The source is node-registered (cells centred on whole degrees): widen by half a cell.
    bbox = (float(lon.min()) - abs(dlon) / 2, float(lat.min()) - abs(dlat) / 2,
            float(lon.max()) + abs(dlon) / 2, float(lat.max()) + abs(dlat) / 2)
    times = tuple(float(t) for t in ds["time"].values)
    return Field(raw=values.astype(np.float64), bbox=bbox, times=times)


def sample(grid: Field, lon: float, lat: float, t_bp: int) -> float | None:
    """Modelled RSL at an indicator, or None when it falls outside the field's window."""
    west, south, east, north = grid.bbox
    if not (west <= lon <= east and south <= lat <= north):
        return None
    return round(bilinear_layer(rsl_at(grid, t_bp / 1000.0), grid, lon, lat), 2)


def main() -> int:
    if not HOLSEA.exists():
        print(f"missing {HOLSEA} — run npm run data:fetch -- --tier 2")
        return 1
    indicators = read_indicators()
    print(f"  {len(indicators)} usable indicators")
    if len(indicators) != EXPECTED_INDICATORS:
        print(f"  ! expected {EXPECTED_INDICATORS}; the workbook or the filter changed")
        return 1
    print("  clusters:", dict(Counter(i["cluster"] for i in indicators)))
    print(f"  regions: {len({i['region'] for i in indicators})}")

    for model in MODELS:
        g = grid_of(Path(str(MODEL_NC).format(model=model)))
        for ind in indicators:
            ind.setdefault("model", {})[model] = sample(g, ind["lon"], ind["lat"], ind["tBP"])
        print(f"  sampled {model}")

    covered = 0
    for model in SBALTIC:
        g = grid_of(Path(str(SBALTIC_NC).format(model=model)))
        for ind in indicators:
            v = sample(g, ind["lon"], ind["lat"], ind["tBP"])
            if v is not None:
                ind.setdefault("sbaltic", {})[model] = v
    covered = sum(1 for i in indicators if "sbaltic" in i)
    print(f"  southern-Baltic field covers {covered} of {len(indicators)} indicators")

    OUT.mkdir(parents=True, exist_ok=True)
    doc = {
        "$comment": "Generated by tools/data/rsl_validation.py from rosentau2021 (CC BY 4.0) and the "
                    "Steffen & Kaufmann RSL fields (CC BY 4.0). Input of V-03; see SOURCES.md for attribution.",
        "source": "rosentau2021",
        "models": list(MODELS),
        "sbalticModels": list(SBALTIC),
        "indicators": indicators,
    }
    path = OUT / "rsl-observations.json"
    path.write_text(json.dumps(doc, separators=(",", ":"), sort_keys=True, ensure_ascii=False) + "\n",
                    encoding="utf-8", newline="\n")
    print(f"  wrote {path} ({path.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
