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
 * a separable Euclidean transform is valid. The raster itself is filled here, without a DOM (A-03). On a lon/lat raster the east-west cell size varies with
 * latitude (cos 75 / cos 65 ~ 0.61 across this domain), which that algorithm cannot express. The
 * result is resampled back to a lon/lat grid, so the shader samples it with the same `boxUv` rule
 * as every other grid in the app.
 */
import * as d3Geo from 'd3-geo';
import type { Feature, GeoJsonProperties, Geometry } from 'geojson';

import type { GridGeometry } from './paleo';
import { EVENTS } from './timeline';

/** DATED-1 reaches 95 E and 83 N; clipped here to the RSL / DEM domain (-10...70 E, 45...85 N). */
export const ICE_DOMAIN: GridGeometry = {
  bbox: [-10, 50, 70, 84],
  nx: 800,
  ny: 340
};

/** Distances are stored as Int16: kilometres x 10 (100 m steps, +-3276 km). */
export const ICE_SDF_SCALE = 10;

/**
 * Basal shear stress of the plastic profile, Pa. Exported because `manifest.json` has to record
 * it (`C-07b`, `I-01`): it is the one parameter that decides the thickness the app reports, so a
 * reader of the published data cannot interpret that number without it.
 */
export const ICE_TAU0_PA = 1e5;
const TAU0 = ICE_TAU0_PA;
const RHO_ICE = 917; // kg m-3
const G = 9.81;

/** h(d) = ICE_PROFILE_K * sqrt(d in km), in metres. ~149 m at 1 km, ~2982 m at 400 km. */
export const ICE_PROFILE_K = Math.sqrt((2 * TAU0 * 1000) / (RHO_ICE * G));

/**
 * The plastic profile itself, in metres, from the distance to the margin in km (`C-07`). It is a
 * schematic and not a measurement: DATED-1 publishes margins, not thickness, and the only model
 * that ships thickness is licence-barred (`0-02`), so this is what the shape of a sheet in
 * equilibrium with a basal shear stress of τ₀ ≈ 100 kPa implies. Reported as `modelled`.
 *
 * One owner, because the globe draws the body with the same rule in GLSL (`ice-shaders.ts`
 * `iceThickness`) and `tests/contract/ice.test.ts` holds the two to each other — the readouts and
 * the picture disagreeing about the ice is exactly the class of bug `A-08` was.
 */
export function iceThickness(dKm: number): number {
  return dKm > 0 ? ICE_PROFILE_K * Math.sqrt(dKm) : 0;
}

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

// ─── rasterisation ────────────────────────────────────────────────────────────

type IceGeometry = Feature<Geometry, GeoJsonProperties>;

/**
 * The outlines become rasters twice: as the ice *wall* of the flood fill on the Baltic grid
 * (`iceMaskFor`) and as the solid interior the distance transform measures (`iceSignedDistance`).
 * Both used to go through a DOM `<canvas>`, which made a physics input depend on a browser API and
 * on its fill rules — and left the ice-dammed Baltic Ice Lake with no test coverage at all, since
 * every contract test had to pass `fillWater(..., null)` (`A-03`).
 *
 * The geometry is still d3's. `geoPath` streams through the projection into the same tiny context a
 * canvas would get, so clipping and the adaptive resampling of geodesics are unchanged; only the
 * fill is ours. A canvas thresholds antialiased coverage at half a pixel, this tests the pixel
 * centre, so the two can differ on cells the margin passes through and nowhere else.
 */
class PolygonPath {
  /** One ring per sub-path, flat as [x0, y0, x1, y1, …], in raster pixels. */
  readonly rings: number[][] = [];
  private current: number[] = [];

  beginPath(): void {
    this.rings.length = 0;
  }

  moveTo(x: number, y: number): void {
    this.current = [x, y];
    this.rings.push(this.current);
  }

  lineTo(x: number, y: number): void {
    this.current.push(x, y);
  }

  closePath(): void {
    // The rasteriser closes every ring itself.
  }

  arc(): void {
    // d3-geo only draws arcs for Point geometries; DATED-1 carries polygons.
  }
}

/**
 * Scanline fill with the nonzero winding rule — the default of a canvas `fill()`, and the rule
 * that gets holes right for GeoJSON wound to the specification. A cell is set when its centre lies
 * inside the path.
 */
export function fillPath(rings: readonly number[][], w: number, h: number, out?: Uint8Array): Uint8Array {
  const mask = out ?? new Uint8Array(w * h);
  const xs: number[] = [];
  const dirs: number[] = [];
  for (let r = 0; r < h; r++) {
    const y = r + 0.5;
    xs.length = 0;
    dirs.length = 0;
    for (const ring of rings) {
      const n = ring.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const y0 = ring[i * 2 + 1];
        const y1 = ring[j * 2 + 1];
        if (y0 === y1) continue;
        // Half-open in y: an edge counts on the scanline through its upper end and not its lower
        // one, so a vertex exactly on the scanline is crossed once, not twice.
        const down = y0 < y1;
        if (down ? y < y0 || y >= y1 : y < y1 || y >= y0) continue;
        xs.push(ring[i * 2] + ((y - y0) / (y1 - y0)) * (ring[j * 2] - ring[i * 2]));
        dirs.push(down ? 1 : -1);
      }
    }
    if (xs.length < 2) continue;
    const order = [...xs.keys()].sort((a, b) => xs[a] - xs[b]);
    let winding = 0;
    const row = r * w;
    for (let k = 0; k + 1 < order.length; k++) {
      winding += dirs[order[k]];
      if (!winding) continue;
      const from = Math.max(0, Math.ceil(xs[order[k]] - 0.5));
      const to = Math.min(w - 1, Math.ceil(xs[order[k + 1]] - 0.5) - 1);
      for (let c = from; c <= to; c++) mask[row + c] = 1;
    }
  }
  return mask;
}

/**
 * Longest edge, in degrees, that goes into a projected raster unsplit. ~0.1° is 11 km north-south,
 * well under the ~4 km of a stereographic pixel once d3's own resampling takes over.
 */
const DENSIFY_DEG = 0.1;

/**
 * Splits long edges into short ones, in lon/lat, before anything projects them.
 *
 * A GeoJSON edge is a straight line in coordinate space (RFC 7946 §3.1.1), which is exactly how
 * the lon/lat mask draws it. A projection stream instead resamples it as a great circle, and on
 * this data that is not a detail: the 20 ka DATED-1 margin carries 59 edges longer than 50 km, the
 * longest 236 km, and the two readings of such an edge part by up to 50 km. Densifying first ties
 * the projected raster to the RFC's reading, so the ice wall of the flood fill and the body drawn
 * on the globe follow one outline (`A-09`).
 */
function densify(feature: IceGeometry, step = DENSIFY_DEG): IceGeometry {
  const ring = (r: number[][]): number[][] => {
    const out: number[][] = [];
    for (let i = 0; i + 1 < r.length; i++) {
      const [x0, y0] = r[i];
      const [x1, y1] = r[i + 1];
      out.push([x0, y0]);
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / step);
      for (let k = 1; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
    out.push(r[r.length - 1]);
    return out;
  };
  const g = feature.geometry;
  if (g.type === 'Polygon') {
    return { ...feature, geometry: { type: 'Polygon', coordinates: (g.coordinates as number[][][]).map(ring) } };
  }
  if (g.type === 'MultiPolygon') {
    return {
      ...feature,
      geometry: { type: 'MultiPolygon', coordinates: (g.coordinates as number[][][][]).map(poly => poly.map(ring)) }
    };
  }
  return feature;
}

/** One outline projected and filled into a w × h raster. */
export function rasterise(
  feature: IceGeometry,
  projection: d3Geo.GeoProjection | d3Geo.GeoStreamWrapper,
  w: number,
  h: number,
  out?: Uint8Array
): Uint8Array {
  const path = new PolygonPath();
  d3Geo.geoPath(projection, path)(feature);
  return fillPath(path.rings, w, h, out);
}

/**
 * One DATED-1 outline on a lon/lat grid: the ice wall the flood fill cannot cross (water.ts).
 * Plate carrée, so the raster rows and columns are the grid's own and the projection is a scale.
 */
export function iceMaskFor(feature: IceGeometry | undefined, g: GridGeometry): Uint8Array {
  const mask = new Uint8Array(g.nx * g.ny);
  if (!feature) return mask;
  const [west, south, east, north] = g.bbox;
  const sx = g.nx / (east - west);
  const sy = g.ny / (north - south);
  return rasterise(
    feature,
    d3Geo.geoTransform({
      point(lon: number, lat: number) {
        this.stream.point((lon - west) * sx, (north - lat) * sy);
      }
    }),
    g.nx,
    g.ny,
    mask
  );
}

/**
 * Below this the sheet no longer dams anything in the window, so a frame gets no wall at all. The
 * drawn body keeps fading to `ICE_FADE_KA`, which is a separate question — one is physics input,
 * the other is how the schematic ends.
 */
const ICE_WALL_KA_MIN = 9.5;

/**
 * The Billingen sections straddle the margin passing Billingen around 11.7 ka, so "before" keeps
 * the 12 ka outline and "after" takes the 11 ka one.
 */
const BILLINGEN_SLICE: Record<number, number> = Object.fromEntries(
  EVENTS.filter(e => e.id === 'billingen-before' || e.id === 'billingen-after').map(e => [
    e.t,
    e.id === 'billingen-before' ? 12 : 11
  ])
);

/**
 * The DATED-1 slice whose outline is the ice *wall* of the flood fill at t (cal yr BP), or null
 * where the sheet no longer dams the basin. Deliberately per-frame and on the 1 ka timeline: the
 * wall is an input to a fill that is computed per frame, while the body drawn on the globe
 * interpolates between slices (`iceBracket`).
 *
 * One definition, because two sides ask: the app for its frames and `npm run audit:metrics` for
 * the same numbers outside the browser (`A-03`).
 */
export function iceSliceFor(t: number): number | null {
  const ka = t / 1000;
  if (ka < ICE_WALL_KA_MIN) return null;
  return BILLINGEN_SLICE[t] ?? Math.min(ICE_KA_MAX, Math.max(ICE_KA_MIN, Math.round(ka)));
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
  /**
   * The rectangle that has to fit in the raster, and both of its subtleties are `A-09`.
   *
   * Wound clockwise: that is d3-geo's convention for an exterior ring smaller than a hemisphere,
   * the opposite of RFC 7946. Anticlockwise, as this ring was, d3 reads as the whole sphere minus
   * the rectangle, so `fitWidth` scaled the globe and the field came out at 45 km per pixel
   * instead of the 3.4 km this geometry is sized for.
   *
   * And densified, because the edges of a spherical polygon are great circles: the arc from
   * (−10°, 50°) to (70°, 50°) crosses 57°N in the middle, so the undensified ring excluded the
   * southern Baltic from its own bounds. Cells there projected below the raster and the resample
   * clamped them to its bottom row — the ice field read as solid ice across the southern basin.
   */
  const domain = densify(
    {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[west, south], [west, north], [east, north], [east, south], [west, south]]]
      }
    },
    1
  );

  const proj = d3Geo.geoStereographic().rotate([-PROJ_CENTER[0], -PROJ_CENTER[1]]);
  proj.fitWidth(PROJ_W - 2 * PROJ_PAD, domain);
  const b = d3Geo.geoPath(proj).bounds(domain);
  const ph = Math.ceil(b[1][1] - b[0][1]) + 2 * PROJ_PAD;
  const tr = proj.translate();
  proj.translate([tr[0] - b[0][0] + PROJ_PAD, tr[1] - b[0][1] + PROJ_PAD]);

  // Densified first: the raster is projected, and an unsplit 200 km edge would arrive as a great
  // circle tens of kilometres off the straight lon/lat line the mask uses for the same outline.
  const solid = rasterise(densify(feature), proj, PROJ_W, ph);

  const n = PROJ_W * ph;
  const inner = new Float64Array(n);
  const outer = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const hit = solid[i];
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
 * Exported for `tests/contract/ice.test.ts`, which checks it against a brute-force transform.
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
