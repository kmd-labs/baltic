import type { PhaseId } from '../i18n/i18n.types';
import TIMELINE from '../../../assets/data/timeline.json' with { type: 'json' };

/**
 * The postglacial chronology (plan §1–§2, `C-08`). Times are cal yr BP (Present = 1950).
 *
 * **The boundaries and event times live in `src/assets/data/timeline.json`**, not here. They are
 * literature — dates with citations, and the places where authors disagree — so the contract file
 * is their home (`contract/schema/timeline.schema.json`), and this module imports it rather than
 * keeping a second copy of the same numbers next to it. That is the whole of `C-08`: before it,
 * these were seven hard-coded rows whose provenance was a comment saying "Andrén et al. 2011".
 *
 * It is imported rather than fetched because every frame needs it synchronously — `phaseAt` is
 * called from templates, from the renderers and from the Node-side tools — and 3 KB bundled costs
 * less than a request and an async hole in a hundred call sites. The file is still served as an
 * asset and still validated by `npm run contract:validate`. Loading it through `manifest.json`
 * with the rest is `I-02b` (#64).
 *
 * What stays here is what the contract does not model: the water class and lake flag per phase
 * (behaviour of the scene, not chronology) and the literature lake-level curve.
 */

/**
 * The shape this module needs of the contract file. Declared rather than inferred, and bound by
 * assignment below, so TypeScript still checks the JSON against it: a renamed or missing field
 * fails the build here instead of becoming `undefined` at runtime.
 */
interface TimelineDoc {
  schemaVersion: string;
  phases: readonly {
    id: string;
    start: { tBP: number };
    end: { tBP: number };
    localOnsets?: readonly { place: string; lat: number; lon: number; tBP: number }[];
  }[];
  events: readonly { id: string; tBP: number; disputed?: boolean }[];
}

const DOC: TimelineDoc = TIMELINE;

export type WaterClass = 'ice' | 'fresh' | 'brackish' | 'marine';

export interface Phase {
  id: PhaseId;
  from: number;
  to: number;
  cls: WaterClass;
  lake: boolean;
}

/**
 * Water regime per phase. Not in `timeline.json` because it is not chronology: `lake` decides
 * whether the scene fills the basin to an outlet sill or to the ocean, and `cls` picks the badge
 * and the water colour. The salinity ranges that go with them are content, per phase.
 */
const REGIME: Readonly<Record<PhaseId, { cls: WaterClass; lake: boolean }>> = {
  deglaciation: { cls: 'ice', lake: false },
  bil: { cls: 'fresh', lake: true },
  yoldia: { cls: 'brackish', lake: false },
  ancylus: { cls: 'fresh', lake: true },
  mastogloia: { cls: 'brackish', lake: false },
  littorina: { cls: 'marine', lake: false },
  'post-littorina': { cls: 'brackish', lake: false }
};

/** Basin-wide boundaries from `timeline.json`, each one cited there. */
export const PHASES: readonly Phase[] = DOC.phases.map(p => ({
  id: p.id as PhaseId,
  from: p.start.tBP,
  to: p.end.tBP,
  ...REGIME[p.id as PhaseId]
}));

export type EventId =
  | 'billingen-before'
  | 'billingen-after'
  | 'ancylus-max'
  | 'ancylus-regression'
  | 'littorina-onset'
  | 'littorina-max';

/** Event cross-sections (plan §1), from `timeline.json`. */
export const EVENTS: readonly { id: EventId; t: number; disputed?: boolean }[] = DOC.events.map(e => ({
  id: e.id as EventId,
  t: e.tBP,
  disputed: e.disputed
}));

/**
 * Local phase onsets, kept apart from the basin-wide boundaries because the transitions were not
 * synchronous — the Littorina onset in the Little Belt is about a millennium younger than the
 * boundary. `V-06` (#45) compares its event checks against these, not against the boundary, which
 * is the difference between a check that measures something and one that fails for the wrong
 * reason.
 */
export const LOCAL_ONSETS: readonly { phase: PhaseId; place: string; lat: number; lon: number; tBP: number }[] =
  DOC.phases.flatMap(p =>
    (p.localOnsets ?? []).map(o => ({ phase: p.id as PhaseId, place: o.place, lat: o.lat, lon: o.lon, tBP: o.tBP }))
  );

/** 21 regular frames every 1000 years plus the event cross-sections, oldest first. */
export const FRAMES: readonly number[] = [
  ...new Set([...Array.from({ length: 21 }, (_, i) => 20000 - i * 1000), ...EVENTS.map(e => e.t)])
].sort((a, b) => b - a);

/**
 * Lake level above the contemporaneous ocean, from the literature (plan §2: BIL +25 m,
 * Ancylus up to +10 m). C-06 will derive it from sill elevations instead.
 */
const LAKE_LEVEL: readonly [number, number][] = [
  [16000, 25],
  [11700, 25],
  [11690, 0],
  [10700, 0],
  [10600, 3],
  [10300, 10],
  [10100, 9],
  [10000, 6],
  [9900, 2],
  [9800, 0]
];

export function phaseAt(t: number): Phase {
  return PHASES.find(p => t <= p.from && t > p.to) ?? (t > 20000 ? PHASES[0] : PHASES[PHASES.length - 1]);
}

export function lakeLevelAt(t: number): number {
  if (!phaseAt(t).lake) return 0;
  if (t >= LAKE_LEVEL[0][0]) return LAKE_LEVEL[0][1];
  for (let i = 1; i < LAKE_LEVEL.length; i++) {
    const [tb, vb] = LAKE_LEVEL[i];
    if (t >= tb) {
      const [ta, va] = LAKE_LEVEL[i - 1];
      return vb + ((va - vb) * (t - tb)) / (ta - tb);
    }
  }
  return 0;
}

export function eventAt(t: number) {
  return EVENTS.find(e => e.t === t) ?? null;
}

export function nearestFrame(t: number): number {
  let best = FRAMES[0];
  for (const f of FRAMES) if (Math.abs(f - t) < Math.abs(best - t)) best = f;
  return best;
}

/** Approximate calendar year of a cal BP age. */
export function calendarYear(t: number): number {
  return 1950 - t;
}
