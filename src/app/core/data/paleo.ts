/**
 * H_paleo = H_now − RSL(t), computed in the app from the present-day grid and the RSL cube
 * (contract §5, C-03). No separate eustatic term: RSL already contains it.
 *
 * Sampling rules must match tools/data/postglacial.py exactly (I-01: within 1 m):
 * - time: linear between the source layers, clamped to the cube's range;
 * - space: cell-registered bilinear, clamped at the grid edge.
 *
 * Type-only import keeps this module runnable under `node --experimental-strip-types`.
 */
import type { KmdgGrid } from './kmdg';

export type GridGeometry = Pick<KmdgGrid, 'nx' | 'ny' | 'bbox'>;

export interface RslCube {
  geometry: GridGeometry;
  /** ka BP per layer, in source order (descending). */
  times: number[];
  /** One Float32Array (ny × nx, north first) per layer. */
  layers: Float32Array[];
}

/** RSL field at `ka`, linear in time between the two bracketing layers. */
export function rslAt(cube: RslCube, ka: number): Float32Array {
  const t = cube.times;
  const asc = t[0] < t[t.length - 1];
  const lo = Math.min(t[0], t[t.length - 1]);
  const hi = Math.max(t[0], t[t.length - 1]);
  const k = Math.min(hi, Math.max(lo, ka));
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i];
    const b = t[i + 1];
    const inside = asc ? a <= k && k <= b : b <= k && k <= a;
    if (!inside) continue;
    if (a === b) return cube.layers[i];
    const w = (k - a) / (b - a);
    if (w === 0) return cube.layers[i];
    if (w === 1) return cube.layers[i + 1];
    const A = cube.layers[i];
    const B = cube.layers[i + 1];
    const out = new Float32Array(A.length);
    for (let j = 0; j < A.length; j++) out[j] = A[j] * (1 - w) + B[j] * w;
    return out;
  }
  return cube.layers[t.length - 1];
}

/** Cell-registered bilinear sample, clamped at the edge. */
export function bilinear(layer: ArrayLike<number>, g: GridGeometry, lon: number, lat: number): number {
  const [west, south, east, north] = g.bbox;
  const fx = ((lon - west) / (east - west)) * g.nx - 0.5;
  const fy = ((north - lat) / (north - south)) * g.ny - 0.5;
  const fx0 = Math.floor(fx);
  const fy0 = Math.floor(fy);
  const tx = fx - fx0;
  const ty = fy - fy0;
  const x0 = clampInt(fx0, g.nx);
  const x1 = clampInt(fx0 + 1, g.nx);
  const y0 = clampInt(fy0, g.ny);
  const y1 = clampInt(fy0 + 1, g.ny);
  const top = layer[y0 * g.nx + x0] * (1 - tx) + layer[y0 * g.nx + x1] * tx;
  const bot = layer[y1 * g.nx + x0] * (1 - tx) + layer[y1 * g.nx + x1] * tx;
  return top * (1 - ty) + bot * ty;
}

/**
 * Precomputed bilinear weights from a coarse source grid (RSL, 1°) onto every cell of a fine
 * target grid (DEM), so a new frame costs one multiply-add pass instead of 540k index searches.
 */
export interface Resampler {
  target: GridGeometry;
  idx: Int32Array; // 4 source indices per target cell
  w: Float32Array; // 4 weights per target cell
}

export function buildResampler(source: GridGeometry, target: GridGeometry): Resampler {
  const n = target.nx * target.ny;
  const idx = new Int32Array(n * 4);
  const w = new Float32Array(n * 4);
  const [west, south, east, north] = target.bbox;
  const dx = (east - west) / target.nx;
  const dy = (north - south) / target.ny;
  const [sw, ss, se, sn] = source.bbox;
  for (let r = 0; r < target.ny; r++) {
    const lat = north - (r + 0.5) * dy;
    const fy = ((sn - lat) / (sn - ss)) * source.ny - 0.5;
    const fy0 = Math.floor(fy);
    const ty = fy - fy0;
    const y0 = clampInt(fy0, source.ny);
    const y1 = clampInt(fy0 + 1, source.ny);
    for (let c = 0; c < target.nx; c++) {
      const lon = west + (c + 0.5) * dx;
      const fx = ((lon - sw) / (se - sw)) * source.nx - 0.5;
      const fx0 = Math.floor(fx);
      const tx = fx - fx0;
      const x0 = clampInt(fx0, source.nx);
      const x1 = clampInt(fx0 + 1, source.nx);
      const o = (r * target.nx + c) * 4;
      idx[o] = y0 * source.nx + x0;
      idx[o + 1] = y0 * source.nx + x1;
      idx[o + 2] = y1 * source.nx + x0;
      idx[o + 3] = y1 * source.nx + x1;
      w[o] = (1 - tx) * (1 - ty);
      w[o + 1] = tx * (1 - ty);
      w[o + 2] = (1 - tx) * ty;
      w[o + 3] = tx * ty;
    }
  }
  return { target, idx, w };
}

/** H_paleo for every target cell: H_now − RSL resampled from the coarse field. */
export function paleoElevation(hNow: Float32Array, rsl: Float32Array, rs: Resampler, out?: Float32Array): Float32Array {
  const res = out ?? new Float32Array(hNow.length);
  const { idx, w } = rs;
  for (let i = 0, o = 0; i < hNow.length; i++, o += 4) {
    const r = rsl[idx[o]] * w[o] + rsl[idx[o + 1]] * w[o + 1] + rsl[idx[o + 2]] * w[o + 2] + rsl[idx[o + 3]] * w[o + 3];
    res[i] = hNow[i] - r;
  }
  return res;
}

function clampInt(i: number, n: number): number {
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}
