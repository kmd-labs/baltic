/**
 * Ice-sheet body for the globe (C-07): signed distance to the DATED-1 margin, and the plastic
 * profile that turns that distance into thickness.
 *
 *   h(d) = sqrt(2 * tau0 * d / (rho_i * g))    tau0 ~ 100 kPa -> ~2980 m at 400 km from the margin
 *
 * The thickness is a **schematic** (`dataQuality: "modelled"`): DATED-1 carries outlines only, and
 * the licence-free source set has no thickness field (0-02). It never enters the paleo-DEM — RSL
 * already contains the ice load (C-03).
 *
 * Why a distance field rather than the outlines themselves: the plastic profile needs the distance
 * to the margin anyway, and the ring count of the DATED-1 variants changes between slices (1 -> 16
 * -> 5 rings over 20 -> 10 ka), so vertex morphing has no stable correspondence. Interpolating the
 * distance field instead morphs outline *and* height together, and survives ice lobes merging and
 * splitting.
 *
 * The transform runs in a stereographic raster — conformal, so distances are locally isotropic and
 * a separable Euclidean transform is valid. On a lon/lat raster the east-west cell size varies with
 * latitude (cos 75 / cos 65 ~ 0.61 across this domain), which that algorithm cannot express. The
 * result is resampled back to a lon/lat grid, so the shader samples it with the same `boxUv` rule
 * as every other grid in the app.
 */
import * as d3Geo from 'd3-geo';
import type { Feature, GeoJsonProperties, Geometry } from 'geojson';

import type { GridGeometry } from './paleo';

/** DATED-1 reaches 95 E and 83 N; clipped here to the RSL / DEM domain (-10...70 E, 45...85 N). */
export const ICE_DOMAIN: GridGeometry = {
  bbox: [-10, 50, 70, 84],
  nx: 800,
  ny: 340
};

/** Distances are stored as Int16: kilometres x 10 (100 m steps, +-3276 km). */
export const ICE_SDF_SCALE = 10;

const TAU0 = 1e5; // Pa — basal shear stress
const RHO_ICE = 917; // kg m-3
const G = 9.81;

/** h(d) = ICE_PROFILE_K * sqrt(d in km), in metres. ~149 m at 1 km, ~2982 m at 400 km. */
export const ICE_PROFILE_K = Math.sqrt((2 * TAU0 * 1000) / (RHO_ICE * G));

/** DATED-1 covers 25 -> 10 ka; the prototype ships 20 -> 10 ka. */
export const ICE_KA_MAX = 20;
export const ICE_KA_MIN = 10;
/**
 * DATED-1 stops at 10 ka but Scandinavian remnants survived to ~9.7 ka, so the body fades out over
 * that interval instead of vanishing between two frames — the simplification `C-07` records.
 */
export const ICE_FADE_KA = 9.7;

/** The two DATED-1 slices bracketing `t`, the blend weight and the fade-out factor. */
export interface IceBracket {
  /** Older slice (ka), reached at `w` = 0. */
  kaA: number;
  /** Younger slice (ka), reached at `w` = 1. */
  kaB: number;
  w: number;
  /** 1 inside the DATED-1 range, ramping to 0 at `ICE_FADE_KA`. */
  fade: number;
  /** False only when `t` lands exactly on a source slice. */
  interpolated: boolean;
}

export function iceBracket(t: number): IceBracket | null {
  const ka = t / 1000;
  if (ka < ICE_FADE_KA) return null;
  if (ka < ICE_KA_MIN) {
    const fade = (ka - ICE_FADE_KA) / (ICE_KA_MIN - ICE_FADE_KA);
    return { kaA: ICE_KA_MIN, kaB: ICE_KA_MIN, w: 0, fade, interpolated: true };
  }
  const k = Math.min(ICE_KA_MAX, ka);
  const kaA = Math.min(ICE_KA_MAX, Math.ceil(k));
  const kaB = Math.max(ICE_KA_MIN, Math.floor(k));
  const w = kaA === kaB ? 0 : (kaA - k) / (kaA - kaB);
  return { kaA, kaB, w, fade: 1, interpolated: Math.abs(k - Math.round(k)) > 1e-9 };
}

// ─── signed distance ──────────────────────────────────────────────────────────

/**
  * Width of the stereographic working raster. The projected domain is very nearly square — 80° of
  * longitude at 50–84°N fans out around the pole — so this is also roughly its height, and the cost
  * of the distance transform goes with the square. 860 px is ~4 km per pixel, in line with the rest
  * of the pipeline: DATED-1 is simplified at 0.02° (~2 km) and the RSL grid is 1/20° (~5 km).
  */
const PROJ_W = 860;
/** Margin, so outside distances near the domain edge stay meaningful. */
const PROJ_PAD = 18;
const PROJ_CENTER: [number, number] = [25, 67];
/**
 * The resample projects one lattice point every PROJ_STRIDE cells and interpolates the pixel
 * coordinates in between, instead of calling the projection for all 272 000 cells. The map is
 * smooth over a 0.4° span, so the error is sub-pixel, and this is ~16x fewer projection calls.
 */
const PROJ_STRIDE = 4;
const R_EARTH_KM = 6371;
const FAR = 1e20;

type IceGeometry = Feature<Geometry, GeoJsonProperties>;

/**
 * Signed distance to the margin of one DATED-1 outline, in kilometres x `ICE_SDF_SCALE`, positive
 * inside the ice, on `ICE_DOMAIN` with rows from the north.
 */
export function iceSignedDistance(feature: IceGeometry | undefined): Int16Array {
  const { nx, ny } = ICE_DOMAIN;
  const out = new Int16Array(nx * ny);
  if (!feature) {
    out.fill(-32768);
    return out;
  }

  const [west, south, east, north] = ICE_DOMAIN.bbox;
  const domain = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]]
    }
  };

  const proj = d3Geo.geoStereographic().rotate([-PROJ_CENTER[0], -PROJ_CENTER[1]]);
  proj.fitWidth(PROJ_W - 2 * PROJ_PAD, domain);
  const b = d3Geo.geoPath(proj).bounds(domain);
  const ph = Math.ceil(b[1][1] - b[0][1]) + 2 * PROJ_PAD;
  const tr = proj.translate();
  proj.translate([tr[0] - b[0][0] + PROJ_PAD, tr[1] - b[0][1] + PROJ_PAD]);

  const cv = document.createElement('canvas');
  cv.width = PROJ_W;
  cv.height = ph;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  d3Geo.geoPath(proj, ctx)(feature);
  ctx.fill();
  const px = ctx.getImageData(0, 0, PROJ_W, ph).data;

  const n = PROJ_W * ph;
  const inner = new Float64Array(n);
  const outer = new Float64Array(n);
  const solid = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const hit = px[i * 4 + 3] > 127 ? 1 : 0;
    solid[i] = hit;
    inner[i] = hit ? FAR : 0; // seeds outside -> depth inside
    outer[i] = hit ? 0 : FAR; // seeds inside  -> distance outside
  }
  edt2d(inner, PROJ_W, ph);
  edt2d(outer, PROJ_W, ph);

  const sd = new Float32Array(n);
  for (let i = 0; i < n; i++) sd[i] = solid[i] ? Math.sqrt(inner[i]) : -Math.sqrt(outer[i]);

  const centre = proj(PROJ_CENTER)!;
  const scale = proj.scale();
  const dLon = (east - west) / nx;
  const dLat = (north - south) / ny;
  const limit = 32767 / ICE_SDF_SCALE;

  // Lattice of projected positions, one per PROJ_STRIDE cells in each direction (inclusive of the
  // far edge), interpolated below.
  const lx = Math.ceil(nx / PROJ_STRIDE) + 1;
  const ly = Math.ceil(ny / PROJ_STRIDE) + 1;
  const lat0 = new Float64Array(lx * ly);
  const lon0 = new Float64Array(lx * ly);
  for (let j = 0; j < ly; j++) {
    const lat = north - (Math.min(j * PROJ_STRIDE, ny) + 0.5) * dLat;
    for (let i = 0; i < lx; i++) {
      const lon = west + (Math.min(i * PROJ_STRIDE, nx) + 0.5) * dLon;
      const p = proj([lon, lat]);
      lon0[j * lx + i] = p ? p[0] : NaN;
      lat0[j * lx + i] = p ? p[1] : NaN;
    }
  }

  for (let r = 0; r < ny; r++) {
    const fj = r / PROJ_STRIDE;
    const j0 = Math.min(ly - 2, Math.floor(fj));
    const tj = fj - j0;
    for (let c = 0; c < nx; c++) {
      const fi = c / PROJ_STRIDE;
      const i0 = Math.min(lx - 2, Math.floor(fi));
      const ti = fi - i0;
      const a = j0 * lx + i0;
      const b = a + lx;
      const x = (lon0[a] * (1 - ti) + lon0[a + 1] * ti) * (1 - tj) + (lon0[b] * (1 - ti) + lon0[b + 1] * ti) * tj;
      const y = (lat0[a] * (1 - ti) + lat0[a + 1] * ti) * (1 - tj) + (lat0[b] * (1 - ti) + lat0[b + 1] * ti) * tj;
      if (Number.isNaN(x) || Number.isNaN(y)) {
        out[r * nx + c] = -32768;
        continue;
      }
      // Conformal, so a single scalar converts pixels to kilometres: the local scale is
      // sec^2(c/2) projected units per radian, with c the angular distance from the centre.
      const dx = x - centre[0];
      const dy = y - centre[1];
      const cos2 = 1 / (1 + (dx * dx + dy * dy) / (4 * scale * scale));
      const kmPerPx = (R_EARTH_KM * cos2) / scale;
      const km = bilinearPx(sd, PROJ_W, ph, x - 0.5, y - 0.5) * kmPerPx;
      out[r * nx + c] = Math.round(Math.max(-limit, Math.min(limit, km)) * ICE_SDF_SCALE);
    }
  }
  return out;
}

function bilinearPx(src: Float32Array, w: number, h: number, fx: number, fy: number): number {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const xa = clampInt(x0, w);
  const xb = clampInt(x0 + 1, w);
  const ya = clampInt(y0, h);
  const yb = clampInt(y0 + 1, h);
  const top = src[ya * w + xa] * (1 - tx) + src[ya * w + xb] * tx;
  const bot = src[yb * w + xa] * (1 - tx) + src[yb * w + xb] * tx;
  return top * (1 - ty) + bot * ty;
}

function clampInt(i: number, n: number): number {
  return i < 0 ? 0 : i >= n ? n - 1 : i;
}

/**
 * Exact squared Euclidean distance transform (Felzenszwalb & Huttenlocher 2012): the lower envelope
 * of one parabola per cell, computed per row and then per column. Seeds are 0 and everything else
 * `FAR` — a large finite value rather than Infinity, which would make the parabola intersection NaN
 * where two seedless cells meet.
 *
 * Exported for `tests/contract/ice.test.ts`; the rest of the module needs a canvas, this does not.
 */
export function edt2d(f: Float64Array, w: number, h: number): void {
  const m = Math.max(w, h);
  const line = new Float64Array(m);
  const d = new Float64Array(m);
  const v = new Int32Array(m);
  const z = new Float64Array(m + 1);
  for (let y = 0; y < h; y++) {
    const off = y * w;
    for (let x = 0; x < w; x++) line[x] = f[off + x];
    edt1d(line, w, d, v, z);
    for (let x = 0; x < w; x++) f[off + x] = d[x];
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) line[y] = f[y * w + x];
    edt1d(line, h, d, v, z);
    for (let y = 0; y < h; y++) f[y * w + x] = d[y];
  }
}

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -FAR;
  z[1] = FAR;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = FAR;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
