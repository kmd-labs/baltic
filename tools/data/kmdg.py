"""KMDG/1 — binary grid format of the Baltic data contract (0-06).

Layout is described in contract/README.md. The TypeScript reader is
src/app/core/data/kmdg.ts; both sides are tested against the same fixtures in
contract/fixtures/grid/.

Writing is deterministic (gzip mtime = 0), so a rerun of the pipeline produces
byte-identical files.
"""

from __future__ import annotations

import gzip
import struct
from dataclasses import dataclass

import numpy as np

MAGIC = b"KMDG"
VERSION = 1
FIXED_HEADER = 68

DTYPES = {1: np.dtype("<u1"), 2: np.dtype("<i2"), 3: np.dtype("<f4")}
DTYPE_CODES = {v: k for k, v in DTYPES.items()}

# magic(4s) version(B) dtype(B) nx ny nt(H) headerBytes(H) flags(H)
# west south east north scale offset(d) nodata(i)
_HEAD = struct.Struct("<4sBBHHHHHddddddi")
assert _HEAD.size == FIXED_HEADER


@dataclass(frozen=True)
class Grid:
    """Cell-registered grid. `raw` has shape (nt, ny, nx); row 0 is the north edge."""

    raw: np.ndarray
    bbox: tuple[float, float, float, float]  # west, south, east, north — outer cell edges, degrees
    times: tuple[float, ...]  # ka BP, one per layer
    scale: float = 1.0
    offset: float = 0.0
    nodata: int = 0

    def values(self) -> np.ndarray:
        """Physical values (raw * scale + offset) as float64, NaN where raw == nodata."""
        v = self.raw.astype(np.float64) * self.scale + self.offset
        if self.raw.dtype.kind in "iu":
            v[self.raw == self.nodata] = np.nan
        else:
            v[np.isnan(self.raw)] = np.nan
        return v


def quantize(values: np.ndarray, scale: float, offset: float = 0.0, dtype: str = "<i2", nodata: int = -32768) -> np.ndarray:
    """Physical values → raw integers; NaN → nodata. Raises if a value does not fit the type."""
    dt = np.dtype(dtype)
    info = np.iinfo(dt)
    q = np.round((values - offset) / scale)
    finite = np.isfinite(q)
    if finite.any() and (q[finite].min() < info.min or q[finite].max() > info.max or (q[finite] == nodata).any()):
        raise ValueError(f"values do not fit {dt} with scale {scale}, offset {offset} and nodata {nodata}")
    out = np.where(finite, q, nodata).astype(dt)
    return out


def encode(grid: Grid) -> bytes:
    raw = np.ascontiguousarray(grid.raw)
    if raw.ndim != 3:
        raise ValueError("raw must have shape (nt, ny, nx)")
    raw = raw.astype(raw.dtype.newbyteorder("<"))
    code = DTYPE_CODES.get(raw.dtype)
    if code is None:
        raise ValueError(f"unsupported dtype {raw.dtype}")
    nt, ny, nx = raw.shape
    if len(grid.times) != nt:
        raise ValueError("one time per layer is required")
    if max(nx, ny, nt) > 0xFFFF:
        raise ValueError("dimension does not fit u16")
    west, south, east, north = grid.bbox
    if not (west < east and south < north):
        raise ValueError("bbox must be west < east, south < north")
    header_bytes = FIXED_HEADER + 4 * nt
    head = _HEAD.pack(MAGIC, VERSION, code, nx, ny, nt, header_bytes, 0,
                      west, south, east, north, grid.scale, grid.offset, grid.nodata)
    times = struct.pack(f"<{nt}f", *grid.times)
    return head + times + raw.tobytes()


def decode(buf: bytes) -> Grid:
    if buf[:2] == b"\x1f\x8b":
        buf = gzip.decompress(buf)
    if len(buf) < FIXED_HEADER or buf[:4] != MAGIC:
        raise ValueError("not a KMDG grid")
    (_, version, code, nx, ny, nt, header_bytes, _flags,
     west, south, east, north, scale, offset, nodata) = _HEAD.unpack_from(buf)
    if version != VERSION:
        raise ValueError(f"unsupported KMDG version {version}")
    dt = DTYPES[code]
    times = struct.unpack_from(f"<{nt}f", buf, FIXED_HEADER)
    n = nt * ny * nx
    if len(buf) != header_bytes + n * dt.itemsize:
        raise ValueError("KMDG size does not match its header")
    raw = np.frombuffer(buf, dtype=dt, count=n, offset=header_bytes).reshape(nt, ny, nx)
    return Grid(raw=raw, bbox=(west, south, east, north), times=tuple(times),
                scale=scale, offset=offset, nodata=nodata)


def write(path, grid: Grid) -> None:
    with open(path, "wb") as f:
        f.write(gzip.compress(encode(grid), compresslevel=9, mtime=0))


def read(path) -> Grid:
    with open(path, "rb") as f:
        return decode(f.read())
