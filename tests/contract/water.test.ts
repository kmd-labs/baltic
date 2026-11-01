// Water model of the prototype (src/app/core/data/water.ts): ocean fill + priority-flood basin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, Geometry } from 'geojson';
import { decodeKmdg, gunzipIfNeeded, kmdgLayer } from '../../src/app/core/data/kmdg.ts';
import { iceMaskFor, iceSliceFor } from '../../src/app/core/data/ice-field.ts';
import { FRAMES, lakeLevelAt, phaseAt } from '../../src/app/core/data/timeline.ts';
import { buildResampler, maskFractionAt, paleoElevation, rslAt } from '../../src/app/core/data/paleo.ts';
import {
  basinStats,
  fillWater,
  maskHit,
  oceanSide,
  waterKindAt,
  WATER_LAKE,
  WATER_OCEAN,
  WATER_RULE_GLSL
} from '../../src/app/core/data/water.ts';

test('ocean water stops at a sill above the ocean level', () => {
  // 9 × 5 cells west→east: ocean | sill at +12 m | depression at −40 m | high ground.
  const nx = 9, ny = 5;
  const g = { nx, ny, bbox: [9, 57, 18, 62] as const };
  const hp = new Float32Array(nx * ny).fill(100);
  for (let r = 1; r < ny - 1; r++) {
    hp[r * nx + 0] = -50; // ocean column at lon 9–10 (Skagerrak seeds are at lon 9.2–10.2)
    hp[r * nx + 1] = -50;
    hp[r * nx + 2] = 12; // sill
    for (let c = 3; c < 8; c++) hp[r * nx + c] = -40;
  }
  const { water } = fillWater(g, hp, null);
  assert.equal(water[2 * nx + 0], WATER_OCEAN);
  assert.notEqual(water[2 * nx + 2], WATER_OCEAN, 'the sill stays dry');
  assert.notEqual(water[2 * nx + 5], WATER_OCEAN, 'the depression behind the sill is not ocean');
});

const DATA = join(import.meta.dirname, '..', '..', 'src', 'assets', 'data');
async function grid(rel: string) {
  const b = readFileSync(join(DATA, rel));
  return decodeKmdg(await gunzipIfNeeded(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
}
const baltic = await grid('grid/dem-baltic.bin.gz');
const rslGrid = await grid('grid/rsl.bin.gz');
const cube = { geometry: rslGrid, times: [...rslGrid.times], layers: Array.from({ length: rslGrid.nt }, (_, i) => kmdgLayer(rslGrid, i)) };
const hNow = kmdgLayer(baltic, 0);
const rs = buildResampler(rslGrid, baltic);

test('present-day Baltic: area and volume close to the real basin (≈ 377 thousand km², ≈ 21.7 thousand km³)', () => {
  const hp = paleoElevation(hNow, rslAt(cube, 0), rs);
  const { water, level } = fillWater(baltic, hp, null);
  const s = basinStats(baltic, hp, water, level);
  assert.equal(level, 0);
  assert.ok(s.connected);
  assert.ok(s.areaKm2 > 350_000 && s.areaKm2 < 420_000, `area ${Math.round(s.areaKm2)}`);
  assert.ok(s.volumeKm3 > 19_000 && s.volumeKm3 < 24_000, `volume ${Math.round(s.volumeKm3)}`);
});

test('Ancylus maximum (10.3 ka): the basin is a lake above the ocean', () => {
  const hp = paleoElevation(hNow, rslAt(cube, 10.3), rs);
  const { water, level } = fillWater(baltic, hp, null);
  assert.ok(level > 0, `level ${level}`);
  assert.ok(water.some(w => w === WATER_LAKE));
});

// ── A-01: the readouts and the picture are the same rule ─────────────────────────────────────────
// Time is continuous, the water mask is not: the scene unions the two bracketing frames' masks and
// interpolates the lake level between them (paleo-shaders.ts `waterMask`, `isLakeAt`). `pointInfo`
// and `transect` are built from the primitives exercised here — `maskFractionAt` for the channel,
// `maskHit` for the union, `waterKindAt` for the class — so reading them is reading what the
// tooltip reads. The service itself needs Angular and a Worker and cannot be loaded in Node.
test('mid-interval water class follows the scene rule, not the nearest frame', () => {
  const tA = 11000;
  const tB = 10300;
  const t = 10600; // between the two frames, and nearer tB — so the old rule had a wrong level too
  const w = (tA - t) / (tA - tB);
  const a = fillWater(baltic, paleoElevation(hNow, rslAt(cube, tA / 1000), rs), null);
  const b = fillWater(baltic, paleoElevation(hNow, rslAt(cube, tB / 1000), rs), null);
  const level = a.level + (b.level - a.level) * w;
  assert.ok(level > Math.min(a.level, b.level) && level < Math.max(a.level, b.level), `level ${level}`);

  const hp = paleoElevation(hNow, rslAt(cube, t / 1000), rs);
  const [west, south, east, north] = baltic.bbox;
  const dLon = (east - west) / baltic.nx;
  const dLat = (north - south) / baltic.ny;

  // Where the two frames disagree about a cell, the union is what the picture uses — and that is
  // where a nearest-frame read is free to say something else. Strided to keep the test quick.
  const candidates: number[] = [];
  for (let i = 0; i < hp.length; i++) if (a.water[i] !== b.water[i]) candidates.push(i);
  assert.ok(candidates.length > 1000, `only ${candidates.length} cells differ between the frames`);
  const stride = Math.ceil(candidates.length / 4000);

  let divergent = 0;
  for (let k = 0; k < candidates.length; k += stride) {
    const i = candidates[k];
    const lon = west + ((i % baltic.nx) + 0.5) * dLon;
    const lat = north - (Math.floor(i / baltic.nx) + 0.5) * dLat;
    const hit = (code: number) =>
      maskHit(maskFractionAt(a.water, baltic, code, lon, lat), maskFractionAt(b.water, baltic, code, lon, lat));
    const ocean = hit(WATER_OCEAN);
    const lake = hit(WATER_LAKE);
    const h = hp[i];
    // The rule, stated here independently of the implementation under test.
    const expected = lake && h < level ? 'lake' : ocean && h < 0 ? 'ocean' : 'dry';
    assert.equal(waterKindAt(ocean, lake, h, level), expected, `cell ${i} at ${lon.toFixed(3)} ${lat.toFixed(3)}`);

    // The reading this replaced: the nearest frame's raw mask and that frame's own level.
    const near = b; // nearestFrame(10600) === 10300
    const code = near.water[i];
    const old = code === WATER_LAKE && h < near.level ? 'lake' : code === WATER_OCEAN ? 'ocean' : 'dry';
    if (old !== expected) divergent++;
  }
  // If this ever reaches zero the two rules have converged and the guard below is worthless — far
  // more likely is that someone moved a readout back onto the nearest frame.
  assert.ok(divergent > 0, 'no cell distinguishes the scene rule from the nearest-frame read');
  console.log(`    A-01: ${divergent} of ${Math.ceil(candidates.length / stride)} sampled coastal cells disagree with a nearest-frame read`);
});

// ── A-02: the GPU's copy of the rule is generated from this one ───────────────────────────────────
// `WATER_RULE_GLSL` is the source the shaders actually compile (paleo-shaders.ts injects it into
// COMMON, ice-shaders.ts and block-shaders.ts build on it). Translating that source back to JS and
// running it against the TS functions is what makes "one definition" checkable rather than
// asserted: a structural edit on either side — a flipped precedence, a moved threshold, a changed
// boundary — fails here instead of quietly moving published areas and volumes.
function glslReturn(fn: string): string {
  const at = WATER_RULE_GLSL.indexOf(`bool ${fn}(`);
  assert.ok(at >= 0, `${fn} is missing from WATER_RULE_GLSL`);
  const open = WATER_RULE_GLSL.indexOf('{', at);
  const body = WATER_RULE_GLSL.slice(open + 1, WATER_RULE_GLSL.indexOf('}', open));
  const m = /return([\s\S]*?);/.exec(body);
  assert.ok(m, `${fn} has no return statement`);
  // GLSL and JS share the operators used here; only the names differ. `wm` carries the mask
  // channels the shader sampled, so it arrives as a fraction, not a boolean.
  return m[1]
    .replace(/\bll\.x\b/g, 'lon')
    .replace(/\bll\.y\b/g, 'lat')
    .replace(/\bwm\.x\b/g, 'ocean')
    .replace(/\bwm\.y\b/g, 'lake')
    .replace(/\buLake\b/g, 'level')
    .replace(/isLakeAt\(wm, hp\)/g, 'isLake(ocean, lake, hp, level)');
}

const glslOceanSide = new Function('lon', 'lat', `return ${glslReturn('oceanSide')};`) as (lon: number, lat: number) => boolean;
const glslIsLake = new Function('ocean', 'lake', 'hp', 'level', `return ${glslReturn('isLakeAt')};`) as Rule;
const glslIsOceanRaw = new Function('ocean', 'lake', 'hp', 'level', 'isLake', `return ${glslReturn('isOceanAt')};`);
type Rule = (ocean: number, lake: number, hp: number, level: number) => boolean;
const glslIsOcean: Rule = (o, l, h, v) => glslIsOceanRaw(o, l, h, v, glslIsLake);

test('GLSL oceanSide equals the TS one across the window', () => {
  const [west, south, east, north] = baltic.bbox;
  let checked = 0;
  for (let lat = south; lat <= north; lat += 0.05) {
    for (let lon = west; lon <= east; lon += 0.05) {
      assert.equal(glslOceanSide(lon, lat), oceanSide(lon, lat), `${lon.toFixed(2)} ${lat.toFixed(2)}`);
      checked++;
    }
  }
  assert.ok(checked > 100_000, `only ${checked} points`);
});

test('GLSL lake/ocean precedence equals waterKindAt', () => {
  // 0.5 is the threshold itself and 0.5000001 the first value above it: both sides must agree on
  // which way the boundary falls, not only on the clear cases.
  const fractions = [0, 0.25, 0.5, 0.5000001, 0.75, 1];
  // Levels: connected (0), the model's Yoldia and Ancylus-maximum levels. H_paleo values straddle
  // 0 and each level, including exact equality, where `<` decides.
  for (const level of [0, 7.8, 22.1]) {
    for (const hp of [-1000, -50, -1, -0.001, 0, 0.001, 5, level, level + 0.001, 50]) {
      for (const oa of fractions) {
        for (const ob of fractions) {
          for (const la of fractions) {
            for (const lb of fractions) {
              const ocean = Math.max(oa, ob);
              const lake = Math.max(la, lb);
              // Each predicate on its own, not through a precedence ternary: a caller may ask
              // isOceanAt alone (block-shaders.ts draws one sheet at a time), so the guard inside
              // it has to hold by itself.
              const cpu = waterKindAt(maskHit(oa, ob), maskHit(la, lb), hp, level);
              const where = `ocean ${oa}/${ob} lake ${la}/${lb} hp ${hp} level ${level}`;
              assert.equal(glslIsLake(ocean, lake, hp, level), cpu === 'lake', 'lake: ' + where);
              assert.equal(glslIsOcean(ocean, lake, hp, level), cpu === 'ocean', 'ocean: ' + where);
            }
          }
        }
      }
    }
  }
});

// ── A-03 / A-04: the ice-dammed phase, and the level as a monitored error budget ─────────────────
// The outlines rasterise without a DOM now (ice-field.ts), so the phase where the ice *is* the
// mechanism is finally reachable from here. Before that every test in this file passed
// `fillWater(..., null)` and the whole Baltic Ice Lake went uncovered.
const ice = JSON.parse(readFileSync(join(DATA, 'prototype', 'ice-dated1.json'), 'utf8')) as {
  features: Feature<Geometry, { ka: number; variant: string }>[];
};
const iceCache = new Map<number, Uint8Array>();
/** The ice wall of a frame, by the app's own slice mapping. */
function iceAt(t: number): Uint8Array | null {
  const ka = iceSliceFor(t);
  if (ka == null) return null;
  let mask = iceCache.get(ka);
  if (!mask) {
    mask = iceMaskFor(ice.features.find(f => f.properties.ka === ka && f.properties.variant === 'mc'), baltic);
    iceCache.set(ka, mask);
  }
  return mask;
}
const levelAt = (t: number) => {
  const hp = paleoElevation(hNow, rslAt(cube, t / 1000), rs);
  const { water, level } = fillWater(baltic, hp, iceAt(t));
  return { hp, water, level, stats: basinStats(baltic, hp, water, level) };
};

test('the Baltic Ice Lake is dammed by the ice, not by topography', () => {
  const t = 13000;
  const dammed = levelAt(t);
  assert.ok(dammed.level > 0, `13 ka with the wall: level ${dammed.level.toFixed(1)} m`);
  assert.equal(dammed.stats.connected, false, 'a dammed basin is not ocean-connected');
  assert.ok(dammed.water.some(w => w === WATER_LAKE));

  // Remove the wall and the mechanism goes with it: the same frame drains to the ocean. This is
  // what every test in this file used to measure, and why the phase had no coverage.
  const hp = paleoElevation(hNow, rslAt(cube, t / 1000), rs);
  const open = fillWater(baltic, hp, null);
  assert.equal(open.level, 0, 'without the ice wall the 13 ka basin is not a lake');
  assert.ok(basinStats(baltic, hp, open.water, open.level).connected);
});

/**
 * How far the modelled level may sit from the literature curve before the test fails.
 *
 * Not fitted to the current output: the modelled level is the elevation of the controlling outlet
 * read off the RSL field, and that field is 1° interpolated onto a 0.025° DEM. Between adjacent
 * nodes it steps by 16–19 m on average through 16–11 ka (audit §2, `npm run audit:metrics`), so
 * the outlet elevation carries that much uncertainty before any model error. A budget of 20 m is
 * the input noise of the era, rounded; the point is not agreement but that a divergence cannot
 * grow quietly. Worst deviation when this was written: 13.9 m at 14 ka.
 */
const LEVEL_BUDGET_M = 20;

/**
 * Lake-phase frames where the model finds no lake at all. 16 ka is the one: the sheet still covers
 * the basin and what water there is drains to the ocean, so the model does not reproduce a dammed
 * lake that early. Pinned rather than tolerated — if the set changes, the change should be read.
 */
const CONNECTED_IN_LAKE_PHASE = [16000];

test('modelled lake levels stay inside the error budget against the literature', () => {
  const rows: string[] = [];
  let worst = 0;
  let sq = 0;
  let n = 0;
  for (const t of [...FRAMES].sort((a, b) => b - a)) {
    const { level } = levelAt(t);
    const lit = lakeLevelAt(t);
    const lake = phaseAt(t).lake;
    if (!lake && level === 0) continue;
    if (lake && level === 0) {
      assert.ok(CONNECTED_IN_LAKE_PHASE.includes(t), `${t} BP is a lake phase but the model finds no lake`);
      rows.push(`${t} BP: model connected, literature +${lit} m  (documented divergence)`);
      continue;
    }
    const d = level - lit;
    worst = Math.max(worst, Math.abs(d));
    sq += d * d;
    n++;
    rows.push(`${t} BP ${phaseAt(t).id.padEnd(14)} model ${level.toFixed(1).padStart(6)}  literature ${lit.toFixed(1).padStart(6)}  diff ${d > 0 ? '+' : ''}${d.toFixed(1)}`);
    assert.ok(
      Math.abs(d) <= LEVEL_BUDGET_M,
      `${t} BP: model ${level.toFixed(1)} m vs literature ${lit.toFixed(1)} m, off by ${d.toFixed(1)} m (budget ${LEVEL_BUDGET_M} m)`
    );
  }
  assert.ok(n >= 8, `only ${n} frames carry a modelled lake`);
  for (const r of rows) console.log('    ' + r);
  console.log(`    A-04: ${n} frames, worst ${worst.toFixed(1)} m, RMSE ${Math.sqrt(sq / n).toFixed(1)} m, budget ${LEVEL_BUDGET_M} m`);
});

test('the budget has teeth: breaking the dam puts 13 ka outside it', () => {
  // The negative control for the test above. With the wall gone the spill analysis has nothing to
  // hold the lake, the level drops to 0, and the deviation from the literature's +25 m exceeds the
  // budget — so a budget that passes is saying something.
  const t = 13000;
  const hp = paleoElevation(hNow, rslAt(cube, t / 1000), rs);
  const broken = fillWater(baltic, hp, null).level;
  assert.ok(
    Math.abs(broken - lakeLevelAt(t)) > LEVEL_BUDGET_M,
    `a broken dam left the level within budget: ${broken.toFixed(1)} m vs ${lakeLevelAt(t)} m`
  );
});
