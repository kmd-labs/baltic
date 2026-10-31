// The app recomputes H_paleo = H_now − RSL(t) from the published grids and must agree with the
// pipeline (tools/data/postglacial.py → prototype/checkpoints.json). I-01 DoD: within 1 m.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeKmdg, gunzipIfNeeded, kmdgLayer, type KmdgGrid } from '../../src/app/core/data/kmdg.ts';
import { bilinear, buildResampler, paleoElevation, rslAt, type RslCube } from '../../src/app/core/data/paleo.ts';

const DATA = join(import.meta.dirname, '..', '..', 'src', 'assets', 'data');
const TOLERANCE_M = 1;

async function grid(rel: string): Promise<KmdgGrid> {
  const b = readFileSync(join(DATA, rel));
  return decodeKmdg(await gunzipIfNeeded(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
}

const demGrid = await grid('grid/dem-europe.bin.gz');
const rslGrid = await grid('grid/rsl.bin.gz');
const dem = kmdgLayer(demGrid, 0);
const cube: RslCube = {
  geometry: rslGrid,
  times: [...rslGrid.times],
  layers: Array.from({ length: rslGrid.nt }, (_, i) => kmdgLayer(rslGrid, i)),
};
const checkpoints = JSON.parse(readFileSync(join(DATA, 'prototype', 'checkpoints.json'), 'utf8'));

test('checkpoints cover several places and times', () => {
  assert.ok(checkpoints.points.length >= 30);
});

test(`app H_paleo matches the pipeline within ${TOLERANCE_M} m`, () => {
  let worst = 0;
  for (const p of checkpoints.points) {
    const r = bilinear(rslAt(cube, p.ka), rslGrid, p.lon, p.lat);
    const h = bilinear(dem, demGrid, p.lon, p.lat);
    const diff = Math.abs(h - r - p.hPaleoM);
    worst = Math.max(worst, diff);
    assert.ok(diff <= TOLERANCE_M, `${p.name} ${p.ka} ka: app ${(h - r).toFixed(2)} vs pipeline ${p.hPaleoM}`);
  }
  assert.ok(worst < 0.05, `worst difference ${worst.toFixed(3)} m — sampling rules have drifted apart`);
});

test('rslAt returns the source layer exactly at a source time and clamps outside', () => {
  const i = cube.times.indexOf(cube.times.find(t => Math.abs(t - 11.3) < 1e-3)!);
  assert.equal(rslAt(cube, cube.times[i]), cube.layers[i]);
  assert.equal(rslAt(cube, 99), rslAt(cube, Math.max(...cube.times)));
  assert.equal(rslAt(cube, -5), cube.layers[cube.times.indexOf(0)]);
});

test('precomputed resampler equals direct bilinear sampling', () => {
  const rs = buildResampler(rslGrid, demGrid);
  const rsl = rslAt(cube, 11.3);
  const hp = paleoElevation(dem, rsl, rs);
  const [west, , , north] = demGrid.bbox;
  const dx = (demGrid.bbox[2] - west) / demGrid.nx;
  const dy = (north - demGrid.bbox[1]) / demGrid.ny;
  for (const [r, c] of [[0, 0], [100, 400], [313, 777], [demGrid.ny - 1, demGrid.nx - 1]]) {
    const lon = west + (c + 0.5) * dx;
    const lat = north - (r + 0.5) * dy;
    const direct = dem[r * demGrid.nx + c] - bilinear(rsl, rslGrid, lon, lat);
    assert.ok(Math.abs(hp[r * demGrid.nx + c] - direct) < 1e-3, `cell ${r},${c}`);
  }
});

test('present day: H_paleo equals H_now (RSL is 0 at 0 ka)', () => {
  const rs = buildResampler(rslGrid, demGrid);
  const hp = paleoElevation(dem, rslAt(cube, 0), rs);
  let maxAbs = 0;
  for (let i = 0; i < hp.length; i += 997) maxAbs = Math.max(maxAbs, Math.abs(hp[i] - dem[i]));
  assert.ok(maxAbs < 0.01, `max |H_paleo − H_now| at 0 ka = ${maxAbs}`);
});
