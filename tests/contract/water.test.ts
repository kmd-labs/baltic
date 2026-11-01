// Water model of the prototype (src/app/core/data/water.ts): ocean fill + priority-flood basin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeKmdg, gunzipIfNeeded, kmdgLayer } from '../../src/app/core/data/kmdg.ts';
import { buildResampler, maskFractionAt, paleoElevation, rslAt } from '../../src/app/core/data/paleo.ts';
import { basinStats, fillWater, maskHit, waterKindAt, WATER_LAKE, WATER_OCEAN } from '../../src/app/core/data/water.ts';

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
