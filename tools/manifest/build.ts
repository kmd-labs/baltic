/**
 * Builds `src/assets/data/manifest.json` — the entry point of the published data (`I-01`).
 *
 *   npm run data:manifest
 *   npm run data:manifest -- --report   # print it and write nothing
 *
 * ## Why TypeScript, when plan §6 calls this `emit.py`
 *
 * The same reason the validator is TypeScript (`V-01`): the manifest has to *record* constants,
 * and almost all of them live in the app's data layer. The budgets and the first-load set are in
 * `core/data/assets.ts`, τ₀ is in `core/data/ice-field.ts`, and the spatial interpolation is the
 * rule `core/data/paleo.ts` resamples with. Writing this in Python would mean a second declaration
 * of each — the mistake `A-02` and `A-03` both were.
 *
 * The one thing Python owns is which Steffen & Kaufmann earth model the RSL cube was built from,
 * since that choice is `postglacial.py --model` and the KMDG header has nowhere to keep it. It is
 * not re-typed here either: the pipeline already writes it next to the checkpoints, and this reads
 * it from there. When `0-04` spins the heavy pipeline back up, `data:build` calls this generator
 * after `postglacial.py`, the way it calls the validator.
 *
 * ## What the manifest is for
 *
 * Three things, and the checksums are the least interesting of them. It says which earth model and
 * which interpolation produced the grids, so a paleo-DEM read off them can be interpreted at all;
 * it says which files the app needs before first paint, so the budget is a property of the data and
 * not of a comment; and it gives the app one place to look, so a renamed file is a legible error
 * instead of an empty scene (`I-02b`).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ASSETS, BUDGET, EAGER } from '../../src/app/core/data/assets.ts';
import { ICE_TAU0_PA } from '../../src/app/core/data/ice-field.ts';
import { parseSills } from '../../src/app/core/data/sills.ts';
import { DATA } from '../lib/frames.ts';

/** Contract version this manifest is written against — `frames` became optional in 1.3.0. */
const SCHEMA_VERSION = '1.3.0';

const ROOT = join(DATA, '..', '..', '..');
const MANIFEST = 'manifest.json';

/**
 * Earth model of the published RSL cube, as `postglacial.py` recorded it beside the checkpoints.
 * Read rather than configured: a value typed here could disagree with the grid it describes, and
 * nothing would notice.
 */
function earthModel(): string {
  const p = join(ROOT, 'contract', 'fixtures', 'paleo', 'checkpoints.json');
  const model = (JSON.parse(readFileSync(p, 'utf8')) as { model?: string }).model;
  if (!model) throw new Error(`${p} records no earth model — rerun tools/data/postglacial.py`);
  return model;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const eager = new Set(EAGER);
const files = walk(DATA)
  .map(p => ({ rel: relative(DATA, p).split(sep).join('/'), abs: p }))
  .filter(f => f.rel !== MANIFEST)
  .sort((a, b) => a.rel.localeCompare(b.rel))
  .map(f => {
    const bytes = readFileSync(f.abs);
    const entry: { path: string; bytes: number; sha256: string; firstLoad?: boolean } = {
      path: f.rel,
      bytes: statSync(f.abs).size,
      sha256: createHash('sha256').update(bytes).digest('hex')
    };
    if (eager.has(f.rel)) entry.firstLoad = true;
    return entry;
  });

const missing = EAGER.filter(rel => !files.some(f => f.path === rel));
if (missing.length) {
  console.error(`✗ the app fetches ${missing.join(', ')} on startup, and it is not in src/assets/data`);
  process.exit(1);
}

/**
 * The grids, by the contract's `quantity` and `datum`.
 *
 * `datum` per grid is `present-day`: both the DEMs and the RSL field are referenced to today
 * (RSL is metres relative to 1950, positive = sea higher than now). The manifest's own `datum` is
 * `contemporaneous-geoid`, because that is what the product derived from them — `H_paleo` and every
 * level drawn against it — is referenced to, and confusing the two is hazard §0.2.
 */
const grids = {
  'dem-europe': { path: ASSETS.demEurope, format: 'kmdg/1', quantity: 'elevation', unit: 'm', datum: 'present-day', firstLoad: eager.has(ASSETS.demEurope) },
  'dem-baltic': { path: ASSETS.demBaltic, format: 'kmdg/1', quantity: 'elevation', unit: 'm', datum: 'present-day', firstLoad: eager.has(ASSETS.demBaltic) },
  rsl: { path: ASSETS.rsl, format: 'kmdg/1', quantity: 'rsl', unit: 'm', datum: 'present-day', firstLoad: eager.has(ASSETS.rsl) }
} as const;

/**
 * Every source the published data leans on, rolled up rather than kept by hand: the grids and the
 * outlines name theirs here, and the catalogue and the chronology carry theirs per entry, so the
 * union is derived from the files themselves. `tests/contract/manifest.test.ts` holds the roll-up
 * to that union, which is what stops this list from quietly going stale.
 */
const GRID_SOURCES = ['gebco2024', 'steffen2025_rsl', 'dated1'];

function rolledUpSources(): string[] {
  const ids = new Set(GRID_SOURCES);
  for (const s of parseSills(JSON.parse(readFileSync(join(DATA, ASSETS.sills), 'utf8'))).sills) {
    for (const id of s.sources) ids.add(id);
  }
  const timeline = JSON.parse(readFileSync(join(DATA, 'timeline.json'), 'utf8')) as {
    phases: { start: { sources: string[] }; end: { sources: string[] }; localOnsets?: { sources: string[] }[] }[];
    events: { sources: string[] }[];
  };
  for (const p of timeline.phases) {
    for (const id of [...p.start.sources, ...p.end.sources]) ids.add(id);
    for (const o of p.localOnsets ?? []) for (const id of o.sources) ids.add(id);
  }
  for (const e of timeline.events) for (const id of e.sources) ids.add(id);
  return [...ids].sort();
}

const firstLoadBytes = files.filter(f => f.firstLoad).reduce((s, f) => s + f.bytes, 0);
const totalBytes = files.reduce((s, f) => s + f.bytes, 0);

const manifest = {
  schemaVersion: SCHEMA_VERSION,
  datum: 'contemporaneous-geoid',
  gia: {
    source: 'steffen2025_rsl',
    earthModel: earthModel(),
    // The app resamples the 1° cube onto the DEM bilinearly (`paleo.ts` buildResampler), and
    // `tests/contract/paleo.test.ts` holds the precomputed resampler to direct bilinear sampling,
    // so this is checked rather than asserted. Time is interpolated linearly between the cube's
    // uneven steps.
    spatialInterpolation: 'bilinear',
    timeInterpolation: 'linear'
  },
  ice: { source: 'dated1', tau0Pa: ICE_TAU0_PA },
  budgets: { totalBytes: BUDGET.totalBytes, firstLoadBytes: BUDGET.firstLoadBytes },
  grids,
  files,
  sources: rolledUpSources()
};

// `timeline.json` is published but carries no `firstLoad`, and that is not an oversight: the app
// imports it into the bundle (`timeline.ts`, `C-08`) rather than fetching it, so it costs nothing
// against the fetch budget. The asset copy is there for a reader of the published data.
console.log('\nmanifest.json\n');
console.log(`  earth model        ${manifest.gia.earthModel} (from the pipeline's checkpoints)`);
console.log(`  τ₀                 ${manifest.ice.tau0Pa} Pa`);
console.log(`  sources            ${manifest.sources.join(', ')}`);
console.log(`  files              ${files.length}, ${files.filter(f => f.firstLoad).length} on the first load`);
console.log(
  `  first load         ${(firstLoadBytes / 1024 / 1024).toFixed(2)} of ${(BUDGET.firstLoadBytes / 1024 / 1024).toFixed(2)} MiB`
);
console.log(
  `  all assets         ${(totalBytes / 1024 / 1024).toFixed(2)} of ${(BUDGET.totalBytes / 1024 / 1024).toFixed(2)} MiB\n`
);
for (const f of files) {
  console.log(`  ${f.firstLoad ? 'eager' : '     '}  ${f.bytes.toString().padStart(9)}  ${f.sha256.slice(0, 12)}…  ${f.path}`);
}

if (process.argv.includes('--report')) {
  console.log('\n--report: nothing written\n');
} else {
  // No timestamps anywhere in it: the schema's own rule, so that a rerun is byte-identical and a
  // CI diff means the data moved rather than the clock.
  writeFileSync(join(DATA, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`\nwrote ${join(DATA, MANIFEST)}\n`);
}
