/**
 * Audit metrics — every number quoted in docs/research/baltic-audit-2026-11-01.md.
 *
 * Run it again after any change to the grids, the RSL cube or water.ts and diff the output
 * against the tables in that document: the audit is only worth as much as its reproducibility.
 *
 *   npm run audit:metrics
 *
 * It reads the committed assets in src/assets/data and the app's own data layer, so what it
 * measures is what the app computes — not a parallel re-implementation.
 *
 * The ice wall is included since `A-03`: the DATED-1 outlines rasterise without a DOM
 * (ice-field.ts `iceMaskFor`), and the slice that answers for a frame is the app's own
 * `iceSliceFor`, so the ice-dammed frames below are the app's output and not a no-ice stand-in.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rslAt } from '../../src/app/core/data/paleo.ts';
import { basinStats, fillWater, oceanSide } from '../../src/app/core/data/water.ts';
import { FRAMES, lakeLevelAt, phaseAt } from '../../src/app/core/data/timeline.ts';
import { iceSliceFor } from '../../src/app/core/data/ice-field.ts';
import { sillCheck } from '../../src/app/core/data/sill-check.ts';
import { parseSills } from '../../src/app/core/data/sills.ts';
import { loadFrames, DATA } from '../lib/frames.ts';

const { baltic, cube, hNow, hpAt, iceAt, cell } = await loadFrames();
const [bw, bs, be, bn] = baltic.bbox;
/** The 1° RSL grid the cube is sampled on — section 2 measures the jumps between its nodes. */
const rslGrid = cube.geometry;
/** The shipped sill catalogue (C-05), read through the app reader. */
const SILLS = parseSills(JSON.parse(readFileSync(join(DATA, 'sills.json'), 'utf8'))).sills;

const f1 = (n: number, w: number, d = 1) => n.toFixed(d).padStart(w);

// ── 1. Modelled lake level against the literature curve, with the basin metrics ──────────────
// The level the app renders is the modelled one (PaleoFrame.lakeLevelM); the literature column is
// timeline.ts LAKE_LEVEL. Their disagreement is audit finding B1.
console.log('\n## 1. Lake level: model vs literature, and basin metrics\n');
console.log('  t(BP)  phase            model_m  lit_m   diff   area_kkm2  vol_kkm3  maxdep_m  conn  ice_ka');
for (const t of [...FRAMES].sort((a, b) => b - a)) {
  const hp = hpAt(t);
  const { water, level } = fillWater(baltic, hp, iceAt(t));
  const s = basinStats(baltic, hp, water, level);
  const lit = lakeLevelAt(t);
  console.log(
    String(t).padStart(7), phaseAt(t).id.padEnd(16),
    f1(level, 7), f1(lit, 7), f1(level - lit, 7),
    f1(s.areaKm2 / 1000, 11, 0), f1(s.volumeKm3 / 1000, 9), f1(s.maxDepthM, 9, 0),
    String(s.connected).padStart(6), String(iceSliceFor(t) ?? '—').padStart(7)
  );
}

// ── 2. Resolution of the RSL field ───────────────────────────────────────────────────────────
// The cube is 1°; the DEM it is interpolated onto is 0.025°. The step between neighbouring nodes
// bounds what that interpolation is inventing in between — audit finding B3.
console.log('\n## 2. RSL step between adjacent 1-deg nodes, inside 9-33E / 53-67N\n');
console.log('  t(ka)   max|dRSL|      p95     mean   (metres between neighbouring nodes)');
const [rw, rsouth, re, rn] = rslGrid.bbox;
for (const ka of [16, 13, 11, 10, 8, 4, 0]) {
  const f = rslAt(cube, ka);
  const d: number[] = [];
  for (let r = 0; r < rslGrid.ny; r++) {
    const lat = rn - (r + 0.5) * ((rn - rsouth) / rslGrid.ny);
    if (lat < 53 || lat > 67) continue;
    for (let c = 0; c < rslGrid.nx - 1; c++) {
      const lon = rw + (c + 0.5) * ((re - rw) / rslGrid.nx);
      if (lon < 9 || lon > 32) continue;
      const i = r * rslGrid.nx + c;
      d.push(Math.abs(f[i + 1] - f[i]));
      if (r < rslGrid.ny - 1) d.push(Math.abs(f[i + rslGrid.nx] - f[i]));
    }
  }
  d.sort((a, b) => a - b);
  console.log(f1(ka, 7, 0), f1(d[d.length - 1], 11), f1(d[Math.floor(d.length * 0.95)], 9), f1(d.reduce((s, v) => s + v, 0) / d.length, 8));
}

// ── 3. What a metre of level error costs horizontally ────────────────────────────────────────
// Nearshore bed slope turns the vertical error of §2 into a shoreline displacement.
console.log('\n## 3. Shoreline sensitivity: horizontal shift per 1 m of level error\n');
const hp0 = hpAt(0);
const kmPerCellLat = ((bn - bs) / baltic.ny) * 110.57;
const bands: Record<string, number[]> = { 'S Baltic (53-56N)': [], 'C Baltic (56-60N)': [], 'Bothnia (60-66N)': [] };
for (let r = 1; r < baltic.ny - 1; r++) {
  const lat = bn - (r + 0.5) * ((bn - bs) / baltic.ny);
  const key = lat < 56 ? 'S Baltic (53-56N)' : lat < 60 ? 'C Baltic (56-60N)' : lat < 66 ? 'Bothnia (60-66N)' : '';
  if (!key) continue;
  for (let c = 1; c < baltic.nx - 1; c++) {
    const i = r * baltic.nx + c;
    if (!(hp0[i] < 0 && hp0[i] > -30)) continue; // near-shore cells only
    const gy = Math.abs(hp0[i + baltic.nx] - hp0[i - baltic.nx]) / (2 * kmPerCellLat);
    if (gy > 1e-6 && Number.isFinite(gy)) bands[key].push(gy);
  }
}
for (const [k, v] of Object.entries(bands)) {
  v.sort((a, b) => a - b);
  const med = v[Math.floor(v.length / 2)];
  console.log(' ', k.padEnd(20), 'median slope', f1(med, 7, 3), 'm/km  ->  1 m =', f1(1 / med, 6), 'km of shoreline');
}

// ── 4. Outlets through time ──────────────────────────────────────────────────────────────────
// Which outlet controls, and by what margin. A margin of a few metres is inside the noise of §2 —
// audit finding B2, and the evidence for `V-02`.
console.log('\n## 4. H_paleo at the outlets  [< 0 = submerged, a possible connection]\n');
const epochs = [16, 13, 11.7, 11, 10.3, 9, 8];
console.log('  outlet            ' + epochs.map(k => (k + 'ka').padStart(8)).join(''));
for (const s of SILLS) {
  const row = epochs.map(ka => f1(hpAt(ka * 1000)[cell(s.lon, s.lat)], 8, 0));
  console.log('  ' + s.id.padEnd(18) + row.join(''));
}

// ── 4b. The outlet the model actually spills over ────────────────────────────────────────────
// `H_paleo` at a catalogue point says what that point is doing; it does not say which outlet holds
// the lake up. The fill knows: the level is the highest cell on the cheapest path from the deeps to
// the ocean. Printing it turns the sill-check (`V-02`) from a guess about routes into a measurement
// — and tells `C-05` which points the catalogue is missing.
console.log('\n## 4b. Controlling outlet per frame  [the cell the lake spills over]\n');
console.log('  t(BP)  phase          state      level   outlet            nearest catalogue sill');
for (const t of [...FRAMES].sort((a, b) => b - a)) {
  const hp = hpAt(t);
  const mask = iceAt(t);
  const check = sillCheck(baltic, t, hp, mask, fillWater(baltic, hp, mask), SILLS);
  const where = check.outlet ? `${check.outlet.lon.toFixed(2)}E ${check.outlet.lat.toFixed(2)}N` : '—';
  const near = check.nearest ? `${check.nearest.id} (${check.nearest.km.toFixed(0)} km)` : '—';
  console.log(
    String(t).padStart(7), phaseAt(t).id.padEnd(15), check.state.padEnd(10),
    f1(check.level, 6), ' ' + where.padEnd(18), near + (check.suspect.length ? `   podejrzane: ${check.suspect.join(', ')}` : '')
  );
}

// ── 5. Present-day validation, and DEM fidelity at the deeps ─────────────────────────────────
// The one place the model can be checked against measurement without any extra dataset.
console.log('\n## 5. Present day vs published\n');
const { water: w0, level: l0 } = fillWater(baltic, hp0, null);
const s0 = basinStats(baltic, hp0, w0, l0);
const row = (name: string, got: number, pub: number, unit: string, d = 1) =>
  console.log('  ' + name.padEnd(22) + f1(got, 9, d) + f1(pub, 11, d) + '   ' + f1(((got - pub) / pub) * 100, 6) + '%   ' + unit);
row('basin area', s0.areaKm2 / 1000, 377, 'thousand km2', 0);
row('basin volume', s0.volumeKm3 / 1000, 21.7, 'thousand km3');
row('max depth', s0.maxDepthM, 459, 'm (Landsort Deep)', 0);

console.log('\n  deepest cell in the Landsort window (17.8-19.2E, 58.3-59.0N):');
let deep = 0, dlon = 0, dlat = 0;
for (let r = 0; r < baltic.ny; r++) {
  const lat = bn - (r + 0.5) * ((bn - bs) / baltic.ny);
  if (lat < 58.3 || lat > 59.0) continue;
  for (let c = 0; c < baltic.nx; c++) {
    const lon = bw + (c + 0.5) * ((be - bw) / baltic.nx);
    if (lon < 17.8 || lon > 19.2) continue;
    const v = hp0[r * baltic.nx + c];
    if (v < deep) { deep = v; dlon = lon; dlat = lat; }
  }
}
console.log('   ', f1(deep, 6, 0), 'm at', dlon.toFixed(2) + 'E', dlat.toFixed(2) + 'N   (published -459 m)');

// Sills: the DEM does resolve them, which rules out the obvious explanation for §4.
console.log('\n  present-day sill depths vs published:');
for (const [id, lon, lat, pub] of [['darss', 12.25, 54.60, -18], ['oresund', 12.75, 55.55, -8]] as const) {
  console.log('   ', id.padEnd(10), f1(hp0[cell(lon, lat)], 6, 0), 'm   published', String(pub) + ' m');
}

// Area excluded from the metrics by the hardcoded geographic rule, for reference.
let ocean = 0, total = 0;
for (let r = 0; r < baltic.ny; r++) {
  const lat = bn - (r + 0.5) * ((bn - bs) / baltic.ny);
  for (let c = 0; c < baltic.nx; c++) {
    if (!w0[r * baltic.nx + c]) continue;
    total++;
    if (oceanSide(bw + (c + 0.5) * ((be - bw) / baltic.nx), lat)) ocean++;
  }
}
console.log('\n  oceanSide() excludes', ((ocean / total) * 100).toFixed(1) + '% of present-day water cells from the basin metrics');
console.log('  (one definition in water.ts; the GLSL the shaders compile is generated from it — A-02)\n');
