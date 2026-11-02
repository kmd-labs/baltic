// V-01 / V-06: the validation registry, asserted rather than only printed.
//
// `npm run validate` prints the report and exits non-zero when a blocking check fails. That covers
// a pipeline run and a CI job, but not a developer who never runs it, so the registry is also a
// test: every blocking check has to pass here.
//
// The measured values are pinned with small tolerances on purpose. These numbers are quoted in
// docs/research/baltic-audit-2026-11-01.md and in the backlog, and the thing worth preventing is
// not a wrong number — it is a *silently changed* one. A legitimate change to the grids or the
// water rule should fail here and be re-stated in the documents, which is exactly the discipline
// `A-06` introduced for the audit metrics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { context, runChecks } from '../../tools/validate/checks.ts';
import { checkBbox, checkGeometry, selfIntersections } from '../../tools/validate/topology.ts';

const ctx = await context();
const results = await runChecks(ctx);
const byId = new Map(results.map(r => [r.id, r]));

test('every blocking check passes', () => {
  const blocking = results.filter(r => r.status === 'blocking');
  assert.ok(blocking.length >= 4, `only ${blocking.length} blocking checks`);
  for (const r of blocking) {
    assert.equal(r.pass, true, `${r.id}: ${r.value} vs ${r.expected} — ${r.deviation}${r.note ? ` (${r.note})` : ''}`);
  }
});

test('every check reports its deviation as a number, not a verdict', () => {
  // V-06's DoD: "odchylenie raportowane liczbowo, nie binarnie". A row whose deviation column
  // held "ok" would hide the size of the disagreement, and the size is the interesting part.
  for (const r of results) {
    assert.ok(r.deviation.length > 0, `${r.id} has no deviation`);
    assert.match(r.deviation, /\d/, `${r.id} deviation "${r.deviation}" carries no number`);
    assert.ok(r.value.length > 0 && r.expected.length > 0, `${r.id} is missing a column`);
  }
});

test('reporting checks never decide anything', () => {
  for (const r of results.filter(r => r.status === 'reporting')) {
    assert.equal(r.pass, null, `${r.id} is reporting but returns a verdict`);
  }
});

test('the Billingen fall is the measured 31.3 m, outside the literature band by 3.3 m', () => {
  const r = byId.get('billingen-drop');
  assert.ok(r);
  const drop = Number(/^([\d.]+) m/.exec(r.value)?.[1]);
  assert.ok(Math.abs(drop - 31.3) < 0.2, `drop is ${drop} m, was 31.3 m when this was written`);
  // Above the band, not below it: the model's lake levels run high, they do not run low.
  assert.match(r.deviation, /^\+/, `deviation "${r.deviation}" changed sign`);
});

test('the Little Belt onset lands within a century of the local date', () => {
  const r = byId.get('little-belt-littorina');
  assert.ok(r);
  const crossing = Number(/^(\d+) cal BP/.exec(r.value)?.[1]);
  assert.ok(Math.abs(crossing - 7489) < 60, `crossing is ${crossing} cal BP, was 7489 when this was written`);
  // And it is solved between frames, not snapped to one: 7489 is neither 8000 nor 7000.
  assert.ok(crossing !== 8000 && crossing !== 7000, 'the crossing was snapped to a frame');
});

test('the highstand check is discriminating, not satisfied by any field', () => {
  // A check that passes whatever the data says measures nothing. This one also requires the belt to
  // be a belt: the uplift sites must peak during deglaciation and the subsiding south must show no
  // mid-Holocene highstand. If either stopped holding, the note would carry the complaint.
  const r = byId.get('holocene-highstand');
  assert.ok(r);
  assert.equal(r.pass, true);
  assert.doesNotMatch(r.note ?? '', /peaks at|shows a/, `the belt is misplaced: ${r.note}`);
  assert.match(r.value, /gotland-w 6\.8\d ka/, `Gotland no longer peaks inside the window: ${r.value}`);
});

// V-11: the topology gate, and that it would notice.
//
// The published outlines pass because the pipeline runs `make_valid` and `set_precision`. A gate
// that only ever sees valid data proves nothing about itself, so these feed it the two defects it
// exists to catch. The reason it matters is that the outlines are the *wall* of the flood fill
// (`A-03`): a bow tie in a margin is a lake draining the wrong way, not a cosmetic defect.
const ring = (points: number[][]) => ({ points, where: 'test' });

test('a bow tie is found, a plain square is not', () => {
  const square = ring([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0]
  ]);
  assert.equal(selfIntersections(square).length, 0);

  // The same four corners in an order that crosses itself.
  const bowTie = ring([
    [0, 0],
    [1, 1],
    [1, 0],
    [0, 1],
    [0, 0]
  ]);
  assert.ok(selfIntersections(bowTie).length > 0, 'a self-crossing ring must be reported');

  // Touching at a shared vertex is not a crossing: adjacent segments always share an endpoint.
  const spike = ring([
    [0, 0],
    [2, 0],
    [1, 0],
    [1, 2],
    [0, 0]
  ]);
  assert.equal(selfIntersections(spike).length, 0, 'collinear backtracking is degenerate, not crossing');
});

test('a feature collection with a defect is reported, with where', () => {
  const broken = {
    features: [
      {
        properties: { ka: 12, variant: 'mc' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 1],
              [1, 0],
              [0, 1],
              [0, 0]
            ]
          ]
        }
      },
      // Not closed, and far outside EPSG:4326 — a projected coordinate pair would look like this.
      {
        properties: { ka: 11, variant: 'mc' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [400000, 6000000],
              [400100, 6000000],
              [400100, 6000100]
            ]
          ]
        }
      }
    ]
  };
  const r = checkGeometry(broken);
  assert.equal(r.selfIntersecting.length, 1);
  assert.match(r.selfIntersecting[0].where, /"ka":12/);
  assert.equal(r.malformed.length, 1, `malformed: ${r.malformed.join('; ')}`);
  assert.equal(r.outOfRange.length, 1, `outOfRange: ${r.outOfRange.join('; ')}`);
});

test('a bbox that is not degrees is rejected', () => {
  assert.deepEqual(checkBbox([9, 53, 33, 67]), []);
  assert.ok(checkBbox([33, 53, 9, 67]).some(s => /not west of east/.test(s)));
  assert.ok(checkBbox([9, 67, 33, 53]).some(s => /not south of north/.test(s)));
  // A UTM window: plausible numbers, wrong system.
  assert.ok(checkBbox([400000, 6000000, 500000, 6100000]).length >= 2);
});

test('the published outlines are clean, and the gate says so numerically', () => {
  const r = byId.get('topology-crs-checksums');
  assert.ok(r);
  assert.equal(r.pass, true, r.note);
  assert.match(r.value, /\d+ rings \/ \d+ points/);
  assert.equal(r.deviation, '0 problem(s)');
});
