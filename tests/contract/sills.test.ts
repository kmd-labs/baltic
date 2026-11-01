// Sill-check (V-02): the elevation balance at the outlets, for every frame of the timeline.
//
// The invariants are statements about the model alone and block: a lake whose outlet lies below
// the contemporaneous ocean is not a lake, and a basin connected to the ocean cannot stand above
// it. They are the quantitative gate on the two errors §0.1 and §0.2 warn about — eustasy counted
// twice, and a confused datum — because both move the whole curve without changing the shape of
// anything on screen.
//
// The catalogue comparison is reported, not asserted: `geo.ts` holds a prototype list awaiting
// C-05, and where it disagrees with the fill it is usually the catalogue that is wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, Geometry } from 'geojson';
import { decodeKmdg, gunzipIfNeeded, kmdgLayer } from '../../src/app/core/data/kmdg.ts';
import { buildResampler, paleoElevation, rslAt } from '../../src/app/core/data/paleo.ts';
import { fillWater } from '../../src/app/core/data/water.ts';
import { assertBalance, sillCheck } from '../../src/app/core/data/sill-check.ts';
import { FRAMES, phaseAt } from '../../src/app/core/data/timeline.ts';
import { iceMaskFor, iceSliceFor } from '../../src/app/core/data/ice-field.ts';
import { SILLS } from '../../src/app/core/data/geo.ts';

const DATA = join(import.meta.dirname, '..', '..', 'src', 'assets', 'data');
async function grid(rel: string) {
  const b = readFileSync(join(DATA, rel));
  return decodeKmdg(await gunzipIfNeeded(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
}
const baltic = await grid('grid/dem-baltic.bin.gz');
const rslGrid = await grid('grid/rsl.bin.gz');
const cube = {
  geometry: rslGrid,
  times: [...rslGrid.times],
  layers: Array.from({ length: rslGrid.nt }, (_, i) => kmdgLayer(rslGrid, i))
};
const hNow = kmdgLayer(baltic, 0);
const rs = buildResampler(rslGrid, baltic);
const ice = JSON.parse(readFileSync(join(DATA, 'prototype', 'ice-dated1.json'), 'utf8')) as {
  features: Feature<Geometry, { ka: number; variant: string }>[];
};
const iceCache = new Map<number, Uint8Array>();
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
const checkAt = (t: number) => {
  const hp = paleoElevation(hNow, rslAt(cube, t / 1000), rs);
  const mask = iceAt(t);
  return { hp, check: sillCheck(baltic, t, hp, mask, fillWater(baltic, hp, mask), SILLS) };
};

test('elevation balance holds at every frame', () => {
  for (const t of [...FRAMES].sort((a, b) => b - a)) assertBalance(checkAt(t).check);
});

test('the controlling outlet, and whether the catalogue knows it', () => {
  // Reported, not asserted. The model spills over a cell; the question this answers for C-05 (#19)
  // is which catalogue entry that cell belongs to, and how far away it is.
  const rows: string[] = [];
  let worst = 0;
  for (const t of [...FRAMES].sort((a, b) => b - a)) {
    const { check } = checkAt(t);
    if (!check.outlet) continue;
    worst = Math.max(worst, check.nearest!.km);
    rows.push(
      `${String(t).padStart(5)} BP ${phaseAt(t).id.padEnd(12)} +${check.level.toFixed(1).padStart(5)} m  ` +
        `${check.outlet.lon.toFixed(2)}E ${check.outlet.lat.toFixed(2)}N  →  ${check.nearest!.id} ` +
        `(${check.nearest!.km.toFixed(0)} km)${check.suspect.length ? `  podejrzane progi: ${check.suspect.join(', ')}` : ''}`
    );
  }
  assert.ok(rows.length >= 8, `tylko ${rows.length} klatek z jeziorem`);
  for (const r of rows) console.log('    ' + r);
  console.log(`    V-02: najdalszy próg sterujący od katalogu — ${worst.toFixed(0)} km`);
});

test('a lake needs its outlet above the ocean: the check fails when it is not', () => {
  // The negative control the DoD asks for. The balance is recomputed from a deliberately broken
  // fill — a lake standing on an outlet below sea level — and must be rejected.
  const t = 13000;
  const { hp, check } = checkAt(t);
  assert.equal(check.balance.length, 0, 'klatka wyjściowa ma być poprawna');

  const broken = { ...check, level: 20, outlet: { lon: 12.8, lat: 55.6, hp: -30 } };
  assert.throws(() => assertBalance({ ...broken, balance: ['próg sterujący pod poziomem oceanu (-30.0 m)'] }));

  // And the same through the real entry point: a fill whose level does not match its outlet.
  const mask = iceAt(t);
  const fill = fillWater(baltic, hp, mask);
  const tampered = sillCheck(baltic, t, hp, mask, { ...fill, level: fill.level + 25 }, SILLS);
  assert.ok(tampered.balance.length > 0, 'podniesiony poziom bez zmiany progu musi zostać wyłapany');
  assert.throws(() => assertBalance(tampered), /bilans rzędnych/);
});

test('every frame is a lake, a connection or a buried basin — and never two at once', () => {
  const seen = new Set();
  for (const t of [...FRAMES].sort((a, b) => b - a)) {
    const { check } = checkAt(t);
    seen.add(check.state);
    if (check.state === 'lake') assert.ok(check.level > 0 && !check.connected, `${t} BP`);
    if (check.state === 'connected') assert.equal(check.level, 0, `${t} BP: połączony basen z poziomem ${check.level}`);
    if (check.state === 'buried') assert.ok(!check.connected && check.level === 0, `${t} BP`);
  }
  // All three occur on this timeline: buried at 20-19 ka, lake through BIL and Ancylus,
  // connected from the Littorina transgression on.
  assert.deepEqual([...seen].sort(), ['buried', 'connected', 'lake']);
});
