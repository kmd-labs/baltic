"""Prototype of the postglacial pipeline: C-01 (present-day DEM), C-03 (RSL cube), C-07 (ice outline).

    python tools/data/postglacial.py              # model sk1
    python tools/data/postglacial.py --model j88

Writes to src/assets/data/:
    grid/dem-europe.bin.gz         H_now, GEBCO 2024, 0–50°E / 48–75°N, 0.05°, KMDG/1 int16 (m)
    grid/dem-baltic.bin.gz         H_now, GEBCO 2024, Baltic window 9–33°E / 53–67°N, 1/40°, KMDG/1 int16 (m)
    grid/rsl.bin.gz                RSL(t) of one Steffen & Kaufmann 2025 earth model, 1°, 19 layers, int16 × 0.01 m
    prototype/ice-dated1.json      DATED-1 outlines (mc, min, max) for 20 → 10 ka, simplified GeoJSON

The app derives H_paleo = H_now − RSL(t) itself (contract §5); there is no separate
eustatic term because RSL already contains it (0-02, C-03).

Prototype limits (tracked in C-01 / C-03 / C-04 / C-07):
- DEM covers 0–50°E / 48–75°N only: the GEBCO tile west of 0° is tier 2 (0-05).
- No flood-fill: the app thresholds H_paleo < 0, so closed depressions show as water (C-04).
- Ice is the outline only; thickness (plastic profile) comes with C-07.
- Lakes are water surfaces in GEBCO (C-02).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pyogrio
import rasterio
import xarray as xr
from pyproj import Transformer
from rasterio.enums import Resampling
from rasterio.windows import from_bounds
import shapely
from shapely import make_valid, set_precision
from shapely.geometry import mapping
from shapely.ops import unary_union

from tools.data import kmdg

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "src" / "assets" / "data"

GEBCO = RAW / "gebco2024" / "gebco_2024_n90.0_s0.0_w0.0_e90.0.tif"
DEM_BBOX = (0.0, 48.0, 50.0, 75.0)  # west, south, east, north
DEM_STEP = 0.05  # degrees = 12 GEBCO cells
BALTIC_BBOX = (9.0, 53.0, 33.0, 67.0)
BALTIC_STEP = 1 / 40  # degrees = 6 GEBCO cells
RSL = RAW / "steffen2025_rsl" / "rsl_SK05_skan_{model}.nc"
DATED1 = RAW / "dated1" / "DATED-1_TimeSlices_shp.zip"
ICE_KA = range(10, 21)  # frames 20 → 10 ka sit exactly on DATED-1 slices
ICE_SIMPLIFY_DEG = 0.02
ICE_GRID_DEG = 0.001  # coordinate precision of the published outline


def build_dem(bbox=DEM_BBOX, step=DEM_STEP) -> kmdg.Grid:
    west, south, east, north = bbox
    nx = round((east - west) / step)
    ny = round((north - south) / step)
    with rasterio.open(GEBCO) as ds:
        window = from_bounds(west, south, east, north, ds.transform)
        # Block average of 12 × 12 source cells; rows come north first, as KMDG expects.
        h = ds.read(1, window=window, out_shape=(ny, nx), resampling=Resampling.average, out_dtype="float32")
    raw = kmdg.quantize(h[None].astype(np.float64), scale=1.0)
    return kmdg.Grid(raw=raw, bbox=bbox, times=(0.0,), scale=1.0, offset=0.0, nodata=-32768)


def build_rsl(model: str) -> kmdg.Grid:
    ds = xr.open_dataset(str(RSL).format(model=model))
    rsl = ds["RSL"].transpose("time", "lat", "lon")
    lat, lon = ds["lat"].values, ds["lon"].values
    dlat, dlon = float(lat[1] - lat[0]), float(lon[1] - lon[0])
    values = rsl.values[:, ::-1, :] if dlat > 0 else rsl.values  # north first
    # The source is node-registered (cells centred on whole degrees): widen by half a cell.
    bbox = (float(lon.min()) - abs(dlon) / 2, float(lat.min()) - abs(dlat) / 2,
            float(lon.max()) + abs(dlon) / 2, float(lat.max()) + abs(dlat) / 2)
    times = tuple(float(t) for t in ds["time"].values)
    raw = kmdg.quantize(values.astype(np.float64), scale=0.01)
    return kmdg.Grid(raw=raw, bbox=bbox, times=times, scale=0.01, offset=0.0, nodata=-32768)


def build_ice() -> dict:
    features = []
    to_wgs84 = None
    for ka in ICE_KA:
        for variant in ("mc", "min", "max"):
            path = f"/vsizip/{DATED1.as_posix()}/DATED1 TimeSlices shp/TS{ka}_{variant}.shp"
            meta, geoms = _read_geometries(path)
            if to_wgs84 is None:
                to_wgs84 = Transformer.from_crs(meta["crs"], "EPSG:4326", always_xy=True)
            g = unary_union([make_valid(x) for x in geoms])
            g = shapely.transform(g, lambda xy: np.column_stack(to_wgs84.transform(xy[:, 0], xy[:, 1])))
            g = make_valid(g.simplify(ICE_SIMPLIFY_DEG, preserve_topology=True))
            g = set_precision(g, ICE_GRID_DEG)
            features.append({"type": "Feature", "properties": {"ka": ka, "variant": variant},
                             "geometry": mapping(g)})
    return {"type": "FeatureCollection",
            "properties": {"source": "dated1", "simplifyDeg": ICE_SIMPLIFY_DEG},
            "features": features}


def _read_geometries(path: str):
    from shapely import from_wkb
    meta, _, geometry, _ = pyogrio.raw.read(path)
    return meta, [g for g in from_wkb(geometry) if g is not None and not g.is_empty]


CHECKPOINTS = [("umea", 20.3, 63.8), ("stockholm", 18.07, 59.33), ("gdansk", 18.65, 54.35),
               ("helsinki", 24.94, 60.17), ("copenhagen", 12.57, 55.68), ("oulu", 25.47, 65.01)]
CHECK_KA = [20.0, 16.0, 13.0, 11.3, 10.5, 8.9, 7.8, 6.0, 3.0, 0.0]


def rsl_at(grid: kmdg.Grid, ka: float) -> np.ndarray:
    """RSL field at `ka`, linear in time between source layers, clamped — as rslAt() in paleo.ts."""
    t = np.asarray(grid.times, dtype=np.float64)
    v = grid.values()
    order = np.argsort(t)
    t, v = t[order], v[order]
    k = float(np.clip(ka, t[0], t[-1]))
    i = int(np.clip(np.searchsorted(t, k) - 1, 0, len(t) - 2))
    w = (k - t[i]) / (t[i + 1] - t[i])
    return v[i] * (1 - w) + v[i + 1] * w


def bilinear(grid: kmdg.Grid, layer: int, lon: float, lat: float) -> float:
    return bilinear_layer(grid.values()[layer], grid, lon, lat)


def bilinear_layer(v: np.ndarray, grid: kmdg.Grid, lon: float, lat: float) -> float:
    """Cell-registered bilinear sampling, clamped at the edge — as bilinear() in paleo.ts."""
    west, south, east, north = grid.bbox
    ny, nx = v.shape
    fx = (lon - west) / (east - west) * nx - 0.5
    fy = (north - lat) / (north - south) * ny - 0.5
    x0, y0 = int(np.floor(fx)), int(np.floor(fy))
    tx, ty = fx - x0, fy - y0
    x0, x1 = np.clip([x0, x0 + 1], 0, nx - 1)
    y0, y1 = np.clip([y0, y0 + 1], 0, ny - 1)
    top = v[y0, x0] * (1 - tx) + v[y0, x1] * tx
    bot = v[y1, x0] * (1 - tx) + v[y1, x1] * tx
    return float(top * (1 - ty) + bot * ty)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--model", default="sk1", choices=["f75", "g76", "j88", "l79", "p79", "sk1", "sk2", "sk3"])
    args = ap.parse_args(argv)

    (OUT / "grid").mkdir(parents=True, exist_ok=True)
    (OUT / "prototype").mkdir(parents=True, exist_ok=True)

    dem = build_dem()
    kmdg.write(OUT / "grid" / "dem-europe.bin.gz", dem)
    kmdg.write(OUT / "grid" / "dem-baltic.bin.gz", build_dem(BALTIC_BBOX, BALTIC_STEP))
    rsl = build_rsl(args.model)
    kmdg.write(OUT / "grid" / "rsl.bin.gz", rsl)
    ice = build_ice()
    (OUT / "prototype" / "ice-dated1.json").write_text(
        json.dumps(ice, separators=(",", ":"), sort_keys=True), encoding="utf-8", newline="\n")

    for f in ("grid/dem-europe.bin.gz", "grid/dem-baltic.bin.gz", "grid/rsl.bin.gz", "prototype/ice-dated1.json"):
        print(f"  {f}: {(OUT / f).stat().st_size / 1024:.0f} KB")

    # Checkpoints: H_paleo computed with the app's sampling rules. tests/contract/paleo.test.ts
    # recomputes them from the published grids and must agree within 1 m (I-01).
    points = []
    for name, lon, lat in CHECKPOINTS:
        h = bilinear(dem, 0, lon, lat)
        for ka in CHECK_KA:
            r = bilinear_layer(rsl_at(rsl, ka), rsl, lon, lat)
            points.append({"name": name, "lon": lon, "lat": lat, "ka": ka,
                           "hNowM": round(h, 3), "rslM": round(r, 3), "hPaleoM": round(h - r, 3)})
    (OUT / "prototype" / "checkpoints.json").write_text(
        json.dumps({"model": args.model, "points": points}, indent=1) + "\n", encoding="utf-8", newline="\n")
    for q in points:
        if q["ka"] in (11.3, 8.9, 7.8):
            print(f"  {q['name']} {q['ka']} ka: RSL {q['rslM']:+.1f} m, H_now {q['hNowM']:+.0f} m, H_paleo {q['hPaleoM']:+.0f} m")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main(sys.argv[1:]))
