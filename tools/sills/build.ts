/**
 * Builds `src/assets/data/sills.json` — the sill catalogue of `C-05`.
 *
 *   npm run data:sills              # write the file
 *   npm run data:sills -- --report  # print the derivation and write nothing
 *
 * ## Why this is generated rather than typed
 *
 * The catalogue the prototype carried in `geo.ts` was a list of names with coordinates, and the
 * audit's own correction (II.2 B2, after `V-02`) is about what such a list cannot tell you: the
 * elevation of a named point says what that point is doing, not which outlet the basin actually
 * spills over. Asked directly, the spill analysis answers differently from the list — at 11 ka the
 * controlling cell sits 97 km from the nearest catalogue entry, and Svea never controls at all.
 *
 * So the catalogue is assembled from three things, kept apart on purpose:
 *
 * - **Positions and names** come from the literature (plan §3.2). They are claims about the world
 *   and nothing here overwrites them.
 * - **`elevationM` and `states`** are measured on the committed assets: present-day elevation from
 *   `gebco2024`, and open/closed from `H_paleo = H_now − RSL(t)` with the DATED-1 wall, frame by
 *   frame, through the app's own `fillWater`. One rule for every entry, reproducible by re-running
 *   this script. For Darss and Drogden, where published sill depths exist (−18 m, −8 m), the
 *   report prints both so the agreement is visible rather than asserted.
 * - **`activePeriods`** are only as good as their source, so an entry the repo has no dated
 *   literature for gets an empty array. An empty array is not a claim; an invented century is.
 *
 * One entry is not from the literature at all: `gota-alv`, the route the model actually drains
 * through in the Yoldia window. It carries `hypothesis: true`, because what is established is that
 * the model spills there — not that the Baltic did.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FRAMES, PHASES, phaseAt } from '../../src/app/core/data/timeline.ts';
import { fillWater, WATER_DRY } from '../../src/app/core/data/water.ts';
import { loadFrames, DATA } from '../lib/frames.ts';
import type { SillPoint } from '../../src/app/core/data/sill-check.ts';

/** Version of the contract this file is written against — `method` arrived in 1.1.0. */
const SCHEMA_VERSION = '1.1.0';

/** A derived route is named after a catalogue sill when it falls this close to it. */
const MATCH_KM = 40;
/** Controlling cells within this distance of each other are the same route. */
const CLUSTER_KM = 60;

interface Known extends SillPoint {
  /** Sources for the position and the name, never for the elevation. */
  sources: string[];
  /** Dated periods from the literature; empty where this repo records no dated source. */
  activePeriods: { fromBP: number; toBP: number }[];
  hypothesis: boolean;
  /** Why the periods look the way they do — printed by `--report`, not emitted. */
  note: string;
}

/**
 * The literature catalogue (plan §3.2, backlog `C-05`). Coordinates as the plan lists them.
 *
 * Only Billingen has dates this repo can cite: the first drainage ~13 000 BP, the re-damming in
 * the Younger Dryas, and the final drainage at 11 620–11 700 BP with a 25–28 m fall (plan §2 and
 * §4.1, after Andrén et al. 2011 and Björck 1995). The Darss and Drogden periods are the
 * basin-wide Littorina boundary from the same chronology, not independently dated sill histories —
 * which is all the phase table claims either. Närke, Svea and the Great Belt are listed with no
 * period: their threshold chronologies are what `C-05` wanted SGU's Strandförskjutningsmodell
 * for, and its licence is still unresolved (`0-03`).
 */
const KNOWN: Known[] = [
  {
    id: 'billingen',
    lon: 13.85,
    lat: 58.45,
    sources: ['andren2011', 'bjorck1995'],
    activePeriods: [{ fromBP: 13000, toBP: 11650 }],
    hypothesis: false,
    note: 'first drainage ~13 ka, final 11 620–11 700 BP (fall 25–28 m)'
  },
  {
    id: 'narke',
    lon: 15.3,
    lat: 59.22,
    sources: ['bjorck1995'],
    activePeriods: [],
    hypothesis: false,
    note: 'BIL outlet before Billingen; no dated threshold in this repo (awaiting sgu_strand, 0-03)'
  },
  {
    id: 'svea',
    lon: 14.45,
    lat: 59.2,
    sources: ['bjorck1995'],
    activePeriods: [],
    hypothesis: false,
    note: 'Svea river, the Ancylus outlet of the literature; no dated threshold in this repo'
  },
  {
    id: 'storebaelt',
    lon: 11.0,
    lat: 55.3,
    sources: ['bjorck1995'],
    activePeriods: [],
    hypothesis: false,
    note: 'Dana river / Great Belt; no dated threshold in this repo'
  },
  {
    id: 'darss',
    lon: 12.25,
    lat: 54.6,
    sources: ['andren2011'],
    activePeriods: [{ fromBP: 8500, toBP: 0 }],
    hypothesis: false,
    note: 'marine strait from the basin-wide Littorina boundary onwards; published depth −18 m'
  },
  {
    id: 'oresund',
    lon: 12.75,
    lat: 55.55,
    sources: ['andren2011'],
    activePeriods: [{ fromBP: 8500, toBP: 0 }],
    hypothesis: false,
    note: 'Drogden; marine strait from the Littorina boundary onwards; published depth −8 m'
  }
];

/** Published present-day sill depths, for the report's corroboration column only. */
const PUBLISHED_DEPTH: Record<string, number> = { darss: -18, oresund: -8 };

/**
 * Names for routes the spill analysis finds away from every catalogue entry. A route without a
 * name cannot be shown to anyone, and inventing a literature sill to cover it would be worse than
 * naming the valley it runs down.
 */
const DERIVED_NAMES: { id: string; lon: number; lat: number; within: number; note: string }[] = [
  {
    id: 'gota-alv',
    lon: 12.3,
    lat: 58.3,
    within: 60,
    note: 'outlet of Lake Vänern into the Göta älv valley — where the model drains the Yoldia-window basin'
  }
];

const DEG = Math.PI / 180;
const distKm = (aLon: number, aLat: number, bLon: number, bLat: number) =>
  Math.hypot((bLon - aLon) * Math.cos(((aLat + bLat) / 2) * DEG) * 111.32, (bLat - aLat) * 110.57);

const { baltic, hNow, hpAt, iceAt, cell, lonOf, latOf } = await loadFrames();

// ── 1. What the model does, frame by frame ───────────────────────────────────────────────────

interface FrameSpill {
  t: number;
  level: number;
  /** The cell the basin spills over, or null when it is connected to the ocean (or ice-buried). */
  outlet: number | null;
  /** The fill's own mask: which cells belong to the connected water body it drew. */
  water: Uint8Array;
  ice: Uint8Array | null;
}

const spills: FrameSpill[] = [];
for (const t of FRAMES) {
  const ice = iceAt(t);
  const fill = fillWater(baltic, hpAt(t), ice);
  spills.push({ t, level: fill.level, outlet: fill.outlet >= 0 ? fill.outlet : null, water: fill.water, ice });
}

// ── 2. Cluster the controlling cells into routes ─────────────────────────────────────────────

interface Route {
  cells: number[];
  frames: number[];
}

const routes: Route[] = [];
for (const s of spills) {
  if (s.outlet == null) continue;
  const lon = lonOf(s.outlet);
  const lat = latOf(s.outlet);
  const hit = routes.find(r => r.cells.some(c => distKm(lon, lat, lonOf(c), latOf(c)) <= CLUSTER_KM));
  if (hit) {
    hit.cells.push(s.outlet);
    hit.frames.push(s.t);
  } else {
    routes.push({ cells: [s.outlet], frames: [s.t] });
  }
}

/** Which catalogue entry, if any, a route belongs to. */
function nameOf(route: Route): { id: string; km: number } | null {
  const lon = lonOf(route.cells[0]);
  const lat = latOf(route.cells[0]);
  const best = KNOWN.map(k => ({ id: k.id, km: distKm(lon, lat, k.lon, k.lat) })).sort((a, b) => a.km - b.km)[0];
  return best && best.km <= MATCH_KM ? best : null;
}

// ── 3. Model control and per-phase state for every catalogue entry ───────────────────────────

const entries: Known[] = [...KNOWN];

for (const route of routes) {
  if (nameOf(route)) continue;
  const lon = lonOf(route.cells[0]);
  const lat = latOf(route.cells[0]);
  const named = DERIVED_NAMES.find(d => distKm(lon, lat, d.lon, d.lat) <= d.within);
  if (!named) {
    console.error(
      `✗ the model spills over ${lon.toFixed(2)}E ${lat.toFixed(2)}N at ${route.frames.join(', ')} cal BP ` +
        `and nothing in KNOWN or DERIVED_NAMES is within reach — add a name for it before shipping a catalogue that omits it`
    );
    process.exit(1);
  }
  // The route's own cells, not the name's nominal position: the point of this entry is where the
  // model drains, and the modal cell is the one it uses most often.
  const modal = [...route.cells]
    .map(c => ({ c, n: route.cells.filter(x => x === c).length }))
    .sort((a, b) => b.n - a.n || hNow[b.c] - hNow[a.c])[0].c;
  entries.push({
    id: named.id,
    lon: Number(lonOf(modal).toFixed(3)),
    lat: Number(latOf(modal).toFixed(3)),
    sources: ['gebco2024', 'steffen2025_rsl'],
    activePeriods: [],
    hypothesis: true,
    note: named.note
  });
}

/**
 * Did water pass through this point during a phase? Open when, in at least one of the phase's
 * frames, the point is either part of the connected water body the fill drew or on the route the
 * basin spills over — ice-free in both cases.
 *
 * Membership of the mask rather than "elevation below the surface" is the whole distinction: a
 * point can sit tens of metres under the lake level and still be a separate pothole with no water
 * in it. `V-02` reports exactly those as `suspect`, and Närke and Svea are them (audit II.2 B2),
 * so the weaker test called them open in phases when the lake drained elsewhere. The spilling
 * outlet is the mask's complement: its cell is the rim the water crosses, so the fill leaves it
 * dry while water is by definition passing over it.
 *
 * The phase of a frame comes from `phaseAt` rather than a comparison repeated here, so the
 * catalogue and the app always agree about which frames belong to a phase.
 */
function stateIn(point: SillPoint, phaseId: string): 'open' | 'closed' {
  const i = cell(point.lon, point.lat);
  if (i < 0 || i >= hNow.length) return 'closed';
  for (const s of spills) {
    if (phaseAt(s.t).id !== phaseId || s.ice?.[i]) continue;
    if (s.water[i] !== WATER_DRY) return 'open';
    if (s.outlet != null && distKm(point.lon, point.lat, lonOf(s.outlet), latOf(s.outlet)) <= MATCH_KM) return 'open';
  }
  return 'closed';
}

/** Frames at which the model's controlling cell lies within MATCH_KM of this entry. */
function controlledAt(point: SillPoint): number[] {
  return spills
    .filter(s => s.outlet != null && distKm(point.lon, point.lat, lonOf(s.outlet), latOf(s.outlet)) <= MATCH_KM)
    .map(s => s.t);
}

const sills = entries
  .map(e => {
    const i = cell(e.lon, e.lat);
    const states: Record<string, 'open' | 'closed'> = {};
    for (const p of PHASES) states[p.id] = stateIn(e, p.id);
    return {
      entry: e,
      control: controlledAt(e),
      out: {
        id: e.id,
        lat: e.lat,
        lon: e.lon,
        elevationM: Number(hNow[i].toFixed(1)),
        activePeriods: e.activePeriods,
        states,
        hypothesis: e.hypothesis,
        sources: [...new Set([...e.sources, 'gebco2024', 'steffen2025_rsl'])].sort()
      }
    };
  })
  .sort((a, b) => a.out.id.localeCompare(b.out.id));

// ── 4. Report ────────────────────────────────────────────────────────────────────────────────

console.log('\n## Routes the model spills over\n');
for (const r of routes) {
  const lon = lonOf(r.cells[0]);
  const lat = latOf(r.cells[0]);
  const named = nameOf(r);
  const cells = new Set(r.cells);
  const elev = [...cells].map(c => hNow[c]);
  console.log(
    `  ${lon.toFixed(2)}E ${lat.toFixed(2)}N  ${String(r.frames.length).padStart(2)} frame(s) ` +
      `${String(r.frames[0]).padStart(5)}→${String(r.frames[r.frames.length - 1]).padStart(5)} cal BP  ` +
      `${cells.size} cell(s), H_now ${Math.min(...elev).toFixed(0)}…${Math.max(...elev).toFixed(0)} m  ` +
      `→ ${named ? `${named.id} (${named.km.toFixed(0)} km)` : 'no catalogue entry within ' + MATCH_KM + ' km'}`
  );
}

console.log('\n## Catalogue\n');
console.log('  id            lon     lat    H_now   published   controls at (cal BP)');
for (const s of sills) {
  const pub = PUBLISHED_DEPTH[s.out.id];
  console.log(
    `  ${s.out.id.padEnd(12)} ${s.out.lon.toFixed(2).padStart(6)} ${s.out.lat.toFixed(2).padStart(6)} ` +
      `${s.out.elevationM.toFixed(0).padStart(7)} ${(pub == null ? '—' : `${pub} m`).padStart(11)}   ` +
      (s.control.length ? s.control.join(', ') : 'never') +
      (s.out.hypothesis ? '   [hypothesis]' : '')
  );
}

console.log('\n## Open phases per entry\n');
for (const s of sills) {
  const open = PHASES.filter(p => s.out.states[p.id] === 'open').map(p => p.id);
  console.log(`  ${s.out.id.padEnd(12)} ${open.length ? open.join(', ') : '— closed throughout'}`);
}

console.log('\n## Notes\n');
for (const s of sills) console.log(`  ${s.out.id.padEnd(12)} ${s.entry.note}`);

// ── 5. Emit ──────────────────────────────────────────────────────────────────────────────────

const doc = {
  schemaVersion: SCHEMA_VERSION,
  datum: 'present-day',
  method:
    'Positions and names from the literature (sources per entry); gota-alv is derived from the ' +
    'spill analysis and flagged hypothesis. elevationM is H_now read off gebco2024 at the ' +
    'position, not a published threshold value. states are measured per phase on H_paleo = ' +
    'H_now - RSL(t) with the DATED-1 ice wall, by tools/sills/build.ts. activePeriods are empty ' +
    'where this repo holds no dated source; an empty array is not a claim of inactivity.',
  sills: sills.map(s => s.out)
};

if (process.argv.includes('--report')) {
  console.log('\n--report: nothing written\n');
} else {
  const out = join(DATA, 'sills.json');
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`\nwrote ${out} — ${doc.sills.length} entries\n`);
}
