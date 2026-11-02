// I-01: the manifest describes the data that is actually there.
//
// A manifest is only worth having if it is checked against the directory it claims to describe.
// Every row here is a statement the generator makes that could be false after a file changes and
// nobody reran it — a checksum, a byte count, which files the app needs first, which earth model
// produced the grids. `npm run data:manifest` regenerates it, and CI diffs the result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ASSETS, BUDGET, EAGER, GRID_ID } from '../../src/app/core/data/assets.ts';
import { ManifestError, filePath, gridPath, parseManifest } from '../../src/app/core/data/manifest.ts';
import { ICE_TAU0_PA } from '../../src/app/core/data/ice-field.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const DATA = join(ROOT, 'src', 'assets', 'data');

interface FileEntry {
  path: string;
  bytes: number;
  sha256: string;
  firstLoad?: boolean;
}
interface Manifest {
  schemaVersion: string;
  datum: string;
  gia: { source: string; earthModel: string; spatialInterpolation: string; timeInterpolation: string };
  ice: { source: string; tau0Pa: number } | null;
  budgets: { totalBytes: number; firstLoadBytes: number };
  grids: Record<string, { path: string; format: string; quantity: string; unit: string; datum: string; firstLoad?: boolean }>;
  files: FileEntry[];
  sources: string[];
}

const manifest = JSON.parse(readFileSync(join(DATA, 'manifest.json'), 'utf8')) as Manifest;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const onDisk = walk(DATA)
  .map(p => relative(DATA, p).split(sep).join('/'))
  .filter(p => p !== 'manifest.json')
  .sort();

test('every published file is listed, and every listed file exists', () => {
  assert.deepEqual(
    manifest.files.map(f => f.path).sort(),
    onDisk,
    'manifest.json and src/assets/data disagree about which files exist — rerun npm run data:manifest'
  );
});

test('every checksum and byte count matches the file', () => {
  for (const f of manifest.files) {
    const buf = readFileSync(join(DATA, f.path));
    assert.equal(statSync(join(DATA, f.path)).size, f.bytes, `${f.path}: byte count`);
    assert.equal(createHash('sha256').update(buf).digest('hex'), f.sha256, `${f.path}: sha256`);
  }
});

test('the first-load set is the one the app actually fetches', () => {
  // The app's load list is `ASSETS` in core/data/assets.ts; the manifest says `firstLoad`. If these
  // drifted, the budget would be measuring a different set from the one that delays first paint.
  assert.deepEqual(
    manifest.files.filter(f => f.firstLoad).map(f => f.path).sort(),
    [...EAGER].sort(),
    'firstLoad in the manifest differs from EAGER in assets.ts'
  );
  // timeline.json is published and deliberately not eager: the app imports it into the bundle.
  assert.ok(
    manifest.files.some(f => f.path === 'timeline.json' && !f.firstLoad),
    'timeline.json should be published without firstLoad — it ships inside the bundle'
  );
});

test('the budgets and the recorded parameters come from the code that implements them', () => {
  assert.equal(manifest.budgets.totalBytes, BUDGET.totalBytes);
  assert.equal(manifest.budgets.firstLoadBytes, BUDGET.firstLoadBytes);
  assert.equal(manifest.ice?.tau0Pa, ICE_TAU0_PA, 'τ₀ in the manifest must be the one ice-field.ts uses');
  assert.equal(manifest.gia.spatialInterpolation, 'bilinear');
  assert.equal(manifest.gia.timeInterpolation, 'linear');
  // And the data stays inside its budgets.
  const total = manifest.files.reduce((s, f) => s + f.bytes, 0);
  const first = manifest.files.filter(f => f.firstLoad).reduce((s, f) => s + f.bytes, 0);
  assert.ok(total <= manifest.budgets.totalBytes, `${total} bytes over the total budget`);
  assert.ok(first <= manifest.budgets.firstLoadBytes, `${first} bytes over the first-load budget`);
});

test('the earth model is the one the pipeline recorded, not one typed into the manifest', () => {
  const recorded = (
    JSON.parse(readFileSync(join(ROOT, 'contract', 'fixtures', 'paleo', 'checkpoints.json'), 'utf8')) as {
      model: string;
    }
  ).model;
  assert.equal(manifest.gia.earthModel, recorded, 'manifest.json describes a different earth model than the grids');
  assert.equal(manifest.gia.source, 'steffen2025_rsl', 'the only permitted GIA source (0-02)');
});

test('the grids point at files that exist and carry the right datum', () => {
  const paths = new Set(manifest.files.map(f => f.path));
  for (const [id, g] of Object.entries(manifest.grids)) {
    assert.ok(paths.has(g.path), `grid ${id} points at ${g.path}, which is not published`);
    assert.equal(g.format, 'kmdg/1');
    assert.equal(g.unit, 'm');
    // The grids are referenced to today; the product derived from them is not, and conflating the
    // two is hazard §0.2 — hence the manifest's own datum differing from theirs.
    assert.equal(g.datum, 'present-day', `grid ${id}`);
  }
  assert.equal(manifest.datum, 'contemporaneous-geoid', 'H_paleo and the levels drawn against it');
  for (const p of [ASSETS.demEurope, ASSETS.demBaltic, ASSETS.rsl]) {
    assert.ok(Object.values(manifest.grids).some(g => g.path === p), `${p} is loaded by the app but is not a grid entry`);
  }
});

test('the source roll-up is the union of what the published files cite', () => {
  // Kept derived rather than by hand: a source used by the catalogue or the chronology and missing
  // here would make the Sources panel incomplete (I-04b) while every file still validated.
  const cited = new Set<string>(['gebco2024', 'steffen2025_rsl', 'dated1']);
  const sills = JSON.parse(readFileSync(join(DATA, ASSETS.sills), 'utf8')) as { sills: { sources: string[] }[] };
  for (const s of sills.sills) for (const id of s.sources) cited.add(id);
  const timeline = JSON.parse(readFileSync(join(DATA, 'timeline.json'), 'utf8')) as {
    phases: { start: { sources: string[] }; end: { sources: string[] }; localOnsets?: { sources: string[] }[] }[];
    events: { sources: string[] }[];
  };
  for (const p of timeline.phases) {
    for (const id of [...p.start.sources, ...p.end.sources]) cited.add(id);
    for (const o of p.localOnsets ?? []) for (const id of o.sources) cited.add(id);
  }
  for (const e of timeline.events) for (const id of e.sources) cited.add(id);

  assert.deepEqual([...manifest.sources].sort(), [...cited].sort());
});

// I-02b: the app reads the manifest, so the reader has to refuse a file it cannot trust.

test('the reader refuses a manifest from another major, and says why', () => {
  assert.throws(() => parseManifest({ ...manifest, schemaVersion: '2.0.0' }), /schemaVersion 2\.0\.0 is not 1\.x/);
  assert.throws(() => parseManifest({}), /no schemaVersion/);
  assert.throws(() => parseManifest({ schemaVersion: '1.3.0' }), /no grids/);
  assert.throws(() => parseManifest({ schemaVersion: '1.3.0', grids: {} }), /no files/);
  assert.throws(
    () => parseManifest({ schemaVersion: '1.3.0', grids: {}, files: [{ path: 'x' }] }),
    /no earth model/
  );
  assert.throws(
    () => parseManifest({ schemaVersion: '1.3.0', grids: { rsl: {} }, files: [{ path: 'x' }], gia: { earthModel: 'sk1' } }),
    /grid rsl has no path/
  );
  // Every one of those messages is what the dock shows, so none of them may be empty.
  for (const bad of [{}, { schemaVersion: '2.0.0' }]) {
    try {
      parseManifest(bad);
      assert.fail('should have thrown');
    } catch (e) {
      assert.ok(e instanceof ManifestError && e.message.length > 20, `unhelpful message: ${String(e)}`);
    }
  }
});

test('the app locates its grids by id, and the ids resolve to the declared paths', () => {
  // GRID_ID is what the service asks for; ASSETS is what the generator published. If these parted
  // company the app would fetch a file the manifest never described, or vice versa.
  const m = parseManifest(manifest);
  assert.equal(gridPath(m, GRID_ID.demEurope), ASSETS.demEurope);
  assert.equal(gridPath(m, GRID_ID.demBaltic), ASSETS.demBaltic);
  assert.equal(gridPath(m, GRID_ID.rsl), ASSETS.rsl);
  assert.throws(() => gridPath(m, 'no-such-grid'), /no grid "no-such-grid"/);

  // The non-grid assets have no id in the contract, so the app asks by path and the manifest has
  // to publish it — a rename then fails here and in the dock, not silently as a 404.
  assert.equal(filePath(m, ASSETS.ice), ASSETS.ice);
  assert.equal(filePath(m, ASSETS.sills), ASSETS.sills);
  assert.throws(() => filePath(m, 'ice/renamed.json'), /is not published/);
});
