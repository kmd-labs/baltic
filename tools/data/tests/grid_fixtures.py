"""Builds the KMDG fixtures in contract/fixtures/grid/ shared by the Python and TypeScript tests.

    python -m tools.data.tests.grid_fixtures      # rewrite the fixtures

Each grid has an `<name>.expected.json` with the physical values (null = nodata) the
TypeScript reader must reproduce.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from tools.data import kmdg

FIXTURE_DIR = Path(__file__).resolve().parents[3] / "contract" / "fixtures" / "grid"


def fixtures() -> dict[str, kmdg.Grid]:
    # RSL-like cube: 2 layers × 3 rows × 4 columns, int16 with 1 cm resolution and one nodata cell.
    rsl = np.array([
        [[281.97, 150.0, -25.44, 0.0], [12.34, -0.01, 3.5, np.nan], [-217.31, 241.65, 1.0, -1.0]],
        [[0.0, 0.0, 0.0, 0.0], [0.5, -0.5, 7.77, 8.88], [-327.67, 327.67, 0.01, -0.02]],
    ])
    cube = kmdg.Grid(raw=kmdg.quantize(rsl, scale=0.01), bbox=(-10.5, 44.5, 70.5, 85.5),
                     times=(11.3, 0.0), scale=0.01, offset=0.0, nodata=-32768)
    # Elevation plane: uint8 with offset, to exercise scale + offset.
    elev = np.array([[[0, 10, 20], [250, np.nan, 5]]], dtype=float) * 4 - 100
    plane = kmdg.Grid(raw=kmdg.quantize(elev, scale=4.0, offset=-100.0, dtype="<u1", nodata=255),
                      bbox=(9.0, 53.0, 33.0, 67.0), times=(0.0,), scale=4.0, offset=-100.0, nodata=255)
    # float32 layer: NaN is its own nodata.
    f32 = kmdg.Grid(raw=np.array([[[1.5, np.nan], [-2.25, 1e6]]], dtype="<f4"),
                    bbox=(0.0, 0.0, 1.0, 1.0), times=(0.0,))
    return {"cube-int16": cube, "plane-uint8": plane, "plane-float32": f32}


def expected(grid: kmdg.Grid) -> dict:
    v = grid.values()
    return {
        "nx": int(v.shape[2]), "ny": int(v.shape[1]), "nt": int(v.shape[0]),
        "bbox": list(grid.bbox),
        "times": [round(t, 4) for t in grid.times],
        "values": [[[None if np.isnan(x) else round(float(x), 6) for x in row] for row in layer] for layer in v],
    }


def write_all() -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    for name, grid in fixtures().items():
        kmdg.write(FIXTURE_DIR / f"{name}.kmdg.gz", grid)
        (FIXTURE_DIR / f"{name}.expected.json").write_text(
            json.dumps(expected(grid), indent=1) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    write_all()
