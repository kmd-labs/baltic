// Sill-check (V-02): the elevation balance at the outlets, for every frame of the timeline.
//
// The invariants are statements about the model alone and block: a lake whose outlet lies below
// the contemporaneous ocean is not a lake, and a basin connected to the ocean cannot stand above
// it. They are the quantitative gate on the two errors §0.1 and §0.2 warn about — eustasy counted
// twice, and a confused datum — because both move the whole curve without changing the shape of
// anything on screen.
//
// The catalogue comparison is reported, not asserted: where `sills.json` and the fill disagree it
// is usually the catalogue that is wrong, and saying where is the evidence C-05 was built from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, Geometry } from 'geojson';
import { decodeKmdg, gunzipIfNeeded, kmdgLayer } from '../../src/app/core/data/kmdg.ts';
import { buildResampler, paleoElevation, rslAt } from '../../src/app/core/data/paleo.ts';
import { cellIndex, fillWater } from '../../src/app/core/data/water.ts';
import { assertBalance, sillCheck } from '../../src/app/core/data/sill-check.ts';
import { FRAMES, PHASES, phaseAt } from '../../src/app/core/data/timeline.ts';
import { iceMaskFor, iceSliceFor } from '../../src/app/core/data/ice-field.ts';
import { parseSills } from '../../src/app/core/data/sills.ts';

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
/** The shipped catalogue, through the app's own reader — the file the browser will check against. */
const catalogue = parseSills(JSON.parse(readFileSync(join(DATA, 'sills.json'), 'utf8')));

const checkAt = (t: number) => {
  const hp = paleoElevation(hNow, rslAt(cube, t / 1000), rs);
  const mask = iceAt(t);
  return { hp, check: sillCheck(baltic, t, hp, mask, fillWater(baltic, hp, mask), catalogue.sills) };
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
  const tampered = sillCheck(baltic, t, hp, mask, { ...fill, level: fill.level + 25 }, catalogue.sills);
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

// ── The catalogue itself (C-05) and the route the card names (C-06b) ─────────────────────────

test('sills.json: a file from another major version is refused, not guessed at', () => {
  assert.throws(() => parseSills({ ...catalogue, schemaVersion: '2.0.0' }), /schemaVersion/);
  assert.throws(() => parseSills({ schemaVersion: '1.1.0', datum: 'present-day', sills: [] }), /no sills/);
  assert.throws(
    () => parseSills({ schemaVersion: '1.1.0', datum: 'present-day', sills: [{ id: 'x' }] }),
    /usable position/
  );
});

test('sills.json: every entry carries all seven phases and says where its numbers came from', () => {
  assert.equal(catalogue.datum, 'present-day');
  assert.ok(catalogue.method && catalogue.method.length > 50, 'the file has to state its own method');
  for (const s of catalogue.sills) {
    assert.deepEqual(
      Object.keys(s.states).sort(),
      [...PHASES].map(p => p.id).sort(),
      `${s.id}: states cover ${Object.keys(s.states).length} phases`
    );
    assert.ok(s.sources.length > 0, `${s.id} has no source`);
    // elevationM is read off the DEM, so it is a claim the committed grid can settle. A mismatch
    // means the grid moved and the catalogue was not regenerated (`npm run data:sills`).
    const h = hNow[cellIndex(baltic, s.lon, s.lat)];
    assert.ok(
      Math.abs(h - s.elevationM) < 0.5,
      `${s.id}: elevationM ${s.elevationM} m but the DEM says ${h.toFixed(1)} m — rerun npm run data:sills`
    );
  }
});

test('the catalogue has a name for every route the model spills over', () => {
  // The teeth of C-05. Before it, the Yoldia-window outlet was 97 km from the nearest entry, so
  // the phase card could show a level but not a way out — and naming it `billingen` at 97 km would
  // have been the catalogue's claim dressed up as the model's (audit II.2 B2).
  let worst = { t: 0, km: 0, id: '' };
  let lakes = 0;
  for (const t of [...FRAMES].sort((a, b) => b - a)) {
    const { check } = checkAt(t);
    if (!check.outlet) continue;
    lakes++;
    assert.ok(check.nearest, `${t} BP: outlet with no catalogue entry at all`);
    if (check.nearest.km > worst.km) worst = { t, km: check.nearest.km, id: check.nearest.id };
  }
  assert.ok(lakes >= 8, `only ${lakes} lake frames`);
  console.log(`    C-05: najdalszy próg sterujący od katalogu — ${worst.km.toFixed(0)} km (${worst.t} BP, ${worst.id})`);
  assert.ok(worst.km <= 30, `${worst.t} BP spills ${worst.km.toFixed(0)} km from ${worst.id} — the catalogue is missing a route`);
});

test('a hypothesis entry is flagged as one, and a literature entry is not', () => {
  // `gota-alv` is where the model drains, not a sill the literature establishes; the flag is what
  // the phase card turns into a badge. Entries with literature sources must not carry it.
  const byId = new Map(catalogue.sills.map(s => [s.id, s]));
  const derived = byId.get('gota-alv');
  assert.ok(derived, 'the model drains through gota-alv at 11 ka; it has to be in the catalogue');
  assert.equal(derived.hypothesis, true);
  assert.deepEqual([...derived.activePeriods], [], 'a model route has no dated literature period');

  for (const s of catalogue.sills) {
    const cited = s.sources.some(id => !['gebco2024', 'steffen2025_rsl'].includes(id));
    assert.equal(s.hypothesis, !cited, `${s.id}: hypothesis ${s.hypothesis} with sources ${s.sources.join(', ')}`);
  }
});
