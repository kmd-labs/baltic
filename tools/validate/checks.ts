/**
 * The validation registry (`V-01`) and the event checks (`V-06`).
 *
 * ## Why this is TypeScript and not `tools/data/validate.py`
 *
 * Plan §7 puts the validator in Python next to the pipeline. That was written when the pipeline
 * emitted finished frames; it no longer does. The app computes the water mask, the lake level, the
 * outlet and the basin metrics itself, from the grids, in `src/app/core/data` — so a Python
 * validator would have to reimplement the water rule to have anything to check, and the repo has
 * already paid for that mistake twice: the rule existed in two copies (`A-02`) and the ice-slice
 * mapping in two (`A-03`), and both diverged. A check that re-derives what it validates measures
 * its own copy.
 *
 * So the registry runs the app's own functions, the same ones the scene and the tooltip call. What
 * stays Python is what Python owns: reading the source NetCDF and writing the grids.
 *
 * ## Two statuses, and why the distinction is not cosmetic
 *
 * - **`blocking`** — the run fails. Either an invariant of the model (a dammed lake needs an outlet
 *   above the ocean) or a literature comparison with a budget the current state satisfies, so that
 *   a regression is caught. A budget is stated with its reasoning, never as a round number that
 *   happens to pass.
 * - **`reporting`** — measured and printed, never fails. For quantities where the honest answer is
 *   a number rather than a verdict.
 *
 * Every result carries its deviation numerically, which is `V-06`'s DoD: "odchylenie raportowane
 * liczbowo, nie binarnie". A check that only says pass/fail hides the size of the disagreement, and
 * the size is the interesting part — the Billingen drop is outside the literature band, by 3 m, for
 * a reason this repo already knows (audit B1/B3).
 */
import { rslAt } from '../../src/app/core/data/paleo.ts';
import { cellIndex, fillWater, WATER_OCEAN } from '../../src/app/core/data/water.ts';
import { assertBalance, sillCheck } from '../../src/app/core/data/sill-check.ts';
import { parseSills } from '../../src/app/core/data/sills.ts';
import { FRAMES, LOCAL_ONSETS, lakeLevelAt, phaseAt } from '../../src/app/core/data/timeline.ts';
import { loadFrames, DATA } from '../lib/frames.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Status = 'blocking' | 'reporting';

export interface CheckResult {
  id: string;
  status: Status;
  /** null for a reporting-only measurement, which has nothing to pass or fail. */
  pass: boolean | null;
  /** What the model says. */
  value: string;
  /** What it is being held to — a literature figure, a band, or an invariant. */
  expected: string;
  /** How far apart they are, as a number. Never "ok" or "off". */
  deviation: string;
  /** One line on what limits the comparison, printed under the row. */
  note?: string;
  /** Extra lines the report prints under the row — a scan, a small table. */
  detail?: string[];
}

/**
 * Sites where uplift and eustatic rise cross over, so relative sea level rises and then falls: the
 * Littorina highstand belt of southern Sweden. Picked by behaviour and not by name — the check
 * below also requires the uplift sites (Umeå, Stockholm) and the subsiding south (Gdańsk, Szczecin)
 * *not* to show a mid-Holocene maximum, because a check that any field would pass measures nothing.
 */
const TRANSITION_SITES: readonly [string, number, number][] = [
  ['blekinge', 15.6, 56.15],
  ['oland-s', 16.4, 56.3],
  ['gotland-w', 18.2, 57.4]
];
const UPLIFT_SITES: readonly [string, number, number][] = [
  ['stockholm', 18.07, 59.33],
  ['umea', 20.26, 63.83]
];
const SOUTH_SITES: readonly [string, number, number][] = [
  ['gdansk', 18.65, 54.35],
  ['szczecin', 14.55, 53.43]
];

/** Mid-Holocene highstand window, plan §7 after Andrén et al. 2011. */
const HIGHSTAND = { fromKa: 7.5, toKa: 6.5 };
/** Billingen fall at the final drainage, plan §2 / §4.1. */
const BILLINGEN_DROP = { minM: 25, maxM: 28 };

/**
 * Budget on the Billingen fall. The modelled lake levels themselves run 6–14 m above the
 * literature (audit B1, cause B3: the RSL field is 1° under a 0.025° DEM), and the fall is a
 * difference of two of them, so it inherits part of that error and cannot be held to zero today.
 * 8 m is half the level budget the lake-level test already uses (20 m) and leaves ~5 m of headroom
 * on the current 3.3 m, so it catches a regression without pretending the disagreement is gone.
 * It tightens when `V-03` picks the Earth model.
 */
const BILLINGEN_BUDGET_M = 8;

/**
 * Budget on the Little Belt onset. The crossing is solved continuously, but it is interpolated
 * between RSL nodes 1.0 ka apart in this epoch (7.8 and 6.8 ka), so that spacing — not the
 * arithmetic — is the precision floor. 600 years stays well inside it.
 */
const LITTLE_BELT_BUDGET_YR = 600;

export interface Context {
  frames: Awaited<ReturnType<typeof loadFrames>>;
  sills: ReturnType<typeof parseSills>;
}

export async function context(): Promise<Context> {
  return {
    frames: await loadFrames(),
    sills: parseSills(JSON.parse(readFileSync(join(DATA, 'sills.json'), 'utf8')))
  };
}

const f1 = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1);

/** `V-02` over every frame, through the app's own check. The one invariant that must never fail. */
function sillBalance(ctx: Context): CheckResult {
  const { baltic, hpAt, iceAt } = ctx.frames;
  const failures: string[] = [];
  for (const t of [...FRAMES].sort((a, b) => b - a)) {
    const hp = hpAt(t);
    const ice = iceAt(t);
    try {
      assertBalance(sillCheck(baltic, t, hp, ice, fillWater(baltic, hp, ice), ctx.sills.sills));
    } catch (e) {
      failures.push((e as Error).message);
    }
  }
  return {
    id: 'sill-balance',
    status: 'blocking',
    pass: failures.length === 0,
    value: `${FRAMES.length - failures.length} of ${FRAMES.length} frames balance`,
    expected: 'a dammed lake stands on an outlet above the ocean; a connection has none',
    deviation: `${failures.length} frame(s)`,
    note: failures.length ? failures[0] : undefined
  };
}

/** `V-06`: the fall at the final Billingen drainage. */
function billingenDrop(ctx: Context): CheckResult {
  const { baltic, hpAt, iceAt } = ctx.frames;
  const levelAt = (t: number) => {
    const hp = hpAt(t);
    return fillWater(baltic, hp, iceAt(t)).level;
  };
  const before = levelAt(11750);
  const after = levelAt(11650);
  const drop = before - after;
  const off = drop > BILLINGEN_DROP.maxM ? drop - BILLINGEN_DROP.maxM : drop < BILLINGEN_DROP.minM ? drop - BILLINGEN_DROP.minM : 0;
  return {
    id: 'billingen-drop',
    status: 'blocking',
    pass: Math.abs(off) <= BILLINGEN_BUDGET_M,
    value: `${drop.toFixed(1)} m  (${before.toFixed(1)} → ${after.toFixed(1)} m, 11 750 → 11 650 BP)`,
    expected: `${BILLINGEN_DROP.minM}–${BILLINGEN_DROP.maxM} m`,
    deviation: `${f1(off)} m outside the band, budget ${BILLINGEN_BUDGET_M} m`,
    note: off !== 0 ? 'the modelled lake levels themselves run high (audit B1); the cause is the RSL resolution (B3), i.e. V-03' : undefined
  };
}

/**
 * Time of maximum relative sea level at a site. RSL is the water surface relative to today's land,
 * so its maximum *is* the highstand. Scanned at 10-year steps, but the answer can only land where
 * the field has nodes — which is the point of the note on the result.
 */
function highstandKa(ctx: Context, lon: number, lat: number): { ka: number; m: number } {
  const { cube } = ctx.frames;
  const i = cellIndex(cube.geometry, lon, lat);
  let best = { ka: 0, m: -Infinity };
  for (let ka = 12; ka >= 0; ka -= 0.01) {
    const v = rslAt(cube, ka)[i];
    if (v > best.m) best = { ka, m: v };
  }
  return best;
}

/** `V-06`: the mid-Holocene highstand, and that it appears only where it should. */
function holoceneHighstand(ctx: Context): CheckResult {
  const { cube } = ctx.frames;
  const nodes = [...cube.times].sort((a, b) => a - b);
  /** Distance from a time to the nearest node, in ka — the resolution the answer is pinned to. */
  const nodeGapNear = (ka: number) => {
    const below = [...nodes].reverse().find(n => n <= ka) ?? nodes[0];
    const above = nodes.find(n => n >= ka) ?? nodes[nodes.length - 1];
    return above - below;
  };

  const inWindow = (ka: number) => ka <= HIGHSTAND.fromKa && ka >= HIGHSTAND.toKa;
  const rows = TRANSITION_SITES.map(([id, lon, lat]) => ({ id, ...highstandKa(ctx, lon, lat) }));
  // How far outside the window, in ka, and whether that is more than one node of the field.
  const worst = rows
    .map(r => {
      const off = inWindow(r.ka) ? 0 : r.ka > HIGHSTAND.fromKa ? r.ka - HIGHSTAND.fromKa : r.ka - HIGHSTAND.toKa;
      return { ...r, off, gap: nodeGapNear(r.ka) };
    })
    .sort((a, b) => Math.abs(b.off) - Math.abs(a.off))[0];

  // The discriminating half: the belt is a belt. Pure-uplift sites must peak early and the
  // subsiding south must not peak in the Holocene window at all.
  const wrongPlace: string[] = [];
  for (const [id, lon, lat] of UPLIFT_SITES) {
    const h = highstandKa(ctx, lon, lat);
    if (h.ka < 9) wrongPlace.push(`${id} peaks at ${h.ka.toFixed(1)} ka, not during deglaciation`);
  }
  for (const [id, lon, lat] of SOUTH_SITES) {
    const h = highstandKa(ctx, lon, lat);
    if (inWindow(h.ka) && h.m > 1) wrongPlace.push(`${id} shows a ${h.m.toFixed(1)} m highstand in the window`);
  }

  const withinOneNode = Math.abs(worst.off) <= worst.gap;
  return {
    id: 'holocene-highstand',
    status: 'blocking',
    pass: withinOneNode && wrongPlace.length === 0,
    value: rows.map(r => `${r.id} ${r.ka.toFixed(2)} ka (${r.m.toFixed(1)} m)`).join(', '),
    expected: `maximum in ${HIGHSTAND.fromKa}–${HIGHSTAND.toKa} ka in the transition belt, and nowhere else`,
    deviation: `worst ${worst.id} ${f1(worst.off)} ka outside; one field node there spans ${worst.gap.toFixed(1)} ka`,
    note: wrongPlace.length
      ? wrongPlace.join('; ')
      : `the maximum can only land on an RSL node, so the window 7.5–6.5 ka holds exactly one (${nodes.filter(n => n >= 6.5 && n <= 7.5).map(n => n.toFixed(1)).join(', ') || 'none'}); a site one node late is at the resolution limit, not 0.8 ka wrong`
  };
}

/**
 * `V-06`: when marine water reaches the Little Belt, against the **local** onset from
 * `timeline.json` — not the basin-wide Littorina boundary ~1 ka older, which is the comparison
 * that would make this check fail for the wrong reason (`C-08`).
 */
function littleBeltLittorina(ctx: Context): CheckResult {
  const { baltic, hpAt, iceAt, cell } = ctx.frames;
  const onset = LOCAL_ONSETS.find(o => o.place === 'little-belt');
  if (!onset) {
    return {
      id: 'little-belt-littorina',
      status: 'blocking',
      pass: false,
      value: 'no local onset recorded',
      expected: 'timeline.json carries the Little Belt onset',
      deviation: '—'
    };
  }
  const i = cell(onset.lon, onset.lat);

  // Bracket on the frames by the mask the scene draws — the cell has to become ocean-connected
  // water, not merely drop below zero — then solve H_paleo = 0 inside the bracket, which is where
  // the transition actually is. Frames are 1 ka apart; the crossing is not.
  const ordered = [...FRAMES].sort((a, b) => b - a);
  let dry: number | null = null;
  let wet: number | null = null;
  for (const t of ordered) {
    const hp = hpAt(t);
    const w = fillWater(baltic, hp, iceAt(t)).water[i];
    if (w === WATER_OCEAN) {
      wet = t;
      break;
    }
    dry = t;
  }
  if (dry == null || wet == null) {
    return {
      id: 'little-belt-littorina',
      status: 'blocking',
      pass: false,
      value: 'the cell never becomes ocean-connected water',
      expected: `${onset.tBP} cal BP`,
      deviation: '—'
    };
  }
  let lo = wet;
  let hi = dry;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (hpAt(mid)[i] < 0) lo = mid;
    else hi = mid;
  }
  const crossing = Math.round((lo + hi) / 2);
  const off = crossing - onset.tBP;
  return {
    id: 'little-belt-littorina',
    status: 'blocking',
    pass: Math.abs(off) <= LITTLE_BELT_BUDGET_YR,
    value: `${crossing} cal BP  (ocean between frames ${dry} and ${wet} BP)`,
    expected: `${onset.tBP} cal BP, local onset from timeline.json`,
    deviation: `${off >= 0 ? '+' : '−'}${Math.abs(off)} yr, budget ${LITTLE_BELT_BUDGET_YR} yr`,
    note: 'compared with the local onset, not the basin-wide Littorina boundary ~1 ka older'
  };
}

/**
 * `V-08`: present-day uplift, approximated by the RSL gradient between the 0.9 ka and 0 ka nodes
 * of the cube — the two youngest the field has.
 *
 * Steffen & Kaufmann publish no present-day velocity field, and the models that carry one are
 * licence-barred (`0-02`), so this is an approximation with a stated meaning: **the mean of the
 * last ~900 years, not an instantaneous rate**. That is also why Umeå comes out below the
 * published maximum rather than at it — a 900-year mean of a decelerating process is lower than
 * its present value, so a model that matched 10.3 mm/yr here would be suspect, not better.
 *
 * Reference values are the published figures from the NKG2016LU paper (plan §7): ~10.3 mm/yr at
 * Umeå and the zero line on the German and Polish coast. The grids themselves are licence-❓
 * (`0-03`), so there is no residual map against the field — what the report carries instead is the
 * modelled gradient at named places, which is the honest version of that DoD item until the
 * licence is resolved.
 */
const NKG = { umeaMaxMmYr: 10.3, southToleranceMmYr: 1.5, umeaBudgetMmYr: 3 };

function upliftGradient(ctx: Context): CheckResult {
  const { cube } = ctx.frames;
  const a = rslAt(cube, 0.9);
  const b = rslAt(cube, 0);
  // RSL falls as the land rises, so the uplift rate is the drop over the interval.
  const mmPerYr = (lon: number, lat: number) => {
    const i = cellIndex(cube.geometry, lon, lat);
    return ((a[i] - b[i]) / 900) * 1000;
  };

  const places: readonly [string, number, number][] = [
    ['umea', 20.26, 63.83],
    ['oulu', 25.47, 65.01],
    ['stockholm', 18.07, 59.33],
    ['copenhagen', 12.57, 55.68],
    ['rugen', 13.4, 54.45],
    ['szczecin', 14.55, 53.43],
    ['gdansk', 18.65, 54.35]
  ];
  const rows = places.map(([id, lon, lat]) => ({ id, v: mmPerYr(lon, lat) }));
  const umea = rows.find(r => r.id === 'umea')!;
  const south = rows.filter(r => ['rugen', 'szczecin', 'gdansk'].includes(r.id));
  const worstSouth = south.sort((x, y) => Math.abs(y.v) - Math.abs(x.v))[0];

  const umeaOff = umea.v - NKG.umeaMaxMmYr;
  const pass = Math.abs(umeaOff) <= NKG.umeaBudgetMmYr && Math.abs(worstSouth.v) <= NKG.southToleranceMmYr;

  // The gradient along the southern coast, as the closest thing to a residual map the licence
  // situation allows: where the model puts the zero line.
  const scan: string[] = [];
  for (let lon = 10; lon <= 22; lon += 2) scan.push(`${lon}°E ${mmPerYr(lon, 54.5).toFixed(2)}`);

  return {
    id: 'uplift-gradient',
    status: 'blocking',
    pass,
    value: rows.map(r => `${r.id} ${r.v.toFixed(2)}`).join(', ') + ' mm/yr',
    expected: `Umeå ≈ ${NKG.umeaMaxMmYr} mm/yr (NKG2016LU max), zero line on the DE/PL coast`,
    deviation: `Umeå ${f1(umeaOff)} mm/yr (budget ${NKG.umeaBudgetMmYr}), worst southern site ${worstSouth.id} ${f1(worstSouth.v)} mm/yr (tolerance ±${NKG.southToleranceMmYr})`,
    note: 'the mean of the last ~900 years, not an instantaneous rate — below the published maximum by construction',
    detail: ['gradient along 54.5°N, mm/yr:', '  ' + scan.join('   ')]
  };
}

/** Reporting: the model against the literature lake-level curve, as audit §1 tabulates it. */
function lakeLevelSpread(ctx: Context): CheckResult {
  const { baltic, hpAt, iceAt } = ctx.frames;
  const diffs: { t: number; d: number }[] = [];
  for (const t of FRAMES) {
    const hp = hpAt(t);
    const level = fillWater(baltic, hp, iceAt(t)).level;
    const lit = lakeLevelAt(t);
    if (level > 0 || lit > 0) diffs.push({ t, d: level - lit });
  }
  const rmse = Math.sqrt(diffs.reduce((s, x) => s + x.d * x.d, 0) / diffs.length);
  const worst = diffs.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  return {
    id: 'lake-level-vs-literature',
    status: 'reporting',
    pass: null,
    value: `RMSE ${rmse.toFixed(1)} m over ${diffs.length} frames`,
    expected: 'BIL +25 m, Ancylus up to +10 m (plan §2)',
    deviation: `worst ${f1(worst.d)} m at ${worst.t} BP (${phaseAt(worst.t).id})`,
    note: 'audit B1; the cause is the 1° RSL field under a 0.025° DEM (B3), so this closes with V-03'
  };
}

/** Reporting: how far the model's spill routes fall from the names the catalogue gives them. */
function outletCatalogue(ctx: Context): CheckResult {
  const { baltic, hpAt, iceAt } = ctx.frames;
  let worst = { t: 0, km: 0, id: '—' };
  let lakes = 0;
  const suspect = new Set<string>();
  for (const t of FRAMES) {
    const hp = hpAt(t);
    const ice = iceAt(t);
    const check = sillCheck(baltic, t, hp, ice, fillWater(baltic, hp, ice), ctx.sills.sills);
    if (!check.outlet || !check.nearest) continue;
    lakes++;
    for (const s of check.suspect) suspect.add(s);
    if (check.nearest.km > worst.km) worst = { t, km: check.nearest.km, id: check.nearest.id };
  }
  return {
    id: 'outlet-catalogue-distance',
    status: 'reporting',
    pass: null,
    value: `${lakes} lake frames, worst ${worst.km.toFixed(0)} km from ${worst.id} at ${worst.t} BP`,
    expected: 'every route named by a catalogue entry near it',
    deviation: `${worst.km.toFixed(0)} km`,
    note: suspect.size ? `submerged but off the drainage path: ${[...suspect].sort().join(', ')}` : undefined
  };
}

export const CHECKS: readonly ((ctx: Context) => CheckResult)[] = [
  sillBalance,
  billingenDrop,
  holoceneHighstand,
  littleBeltLittorina,
  upliftGradient,
  lakeLevelSpread,
  outletCatalogue
];

export async function runChecks(ctx?: Context): Promise<CheckResult[]> {
  const c = ctx ?? (await context());
  return CHECKS.map(fn => fn(c));
}
