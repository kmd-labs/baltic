// Water model of the prototype (src/app/core/data/water.ts): ocean fill + priority-flood basin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeKmdg, gunzipIfNeeded, kmdgLayer } from '../../src/app/core/data/kmdg.ts';
import { buildResampler, paleoElevation, rslAt } from '../../src/app/core/data/paleo.ts';
import { basinStats, fillWater, WATER_LAKE, WATER_OCEAN } from '../../src/app/core/data/water.ts';

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
