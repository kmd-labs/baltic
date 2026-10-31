import type { PhaseId } from '../i18n/i18n.types';

/**
 * Prototype timeline (plan §1–§2). Replaced by timeline.json once C-08 lands.
 * Times are cal yr BP (Present = 1950).
 */

export type WaterClass = 'ice' | 'fresh' | 'brackish' | 'marine';

export interface Phase {
  id: PhaseId;
  from: number;
  to: number;
  cls: WaterClass;
  lake: boolean;
}

/** Basin-wide boundaries, Andrén et al. 2011 via plan §2. */
export const PHASES: readonly Phase[] = [
  { id: 'deglaciation', from: 20000, to: 16000, cls: 'ice', lake: false },
  { id: 'bil', from: 16000, to: 11700, cls: 'fresh', lake: true },
  { id: 'yoldia', from: 11700, to: 10700, cls: 'brackish', lake: false },
  { id: 'ancylus', from: 10700, to: 9800, cls: 'fresh', lake: true },
  { id: 'mastogloia', from: 9800, to: 8500, cls: 'brackish', lake: false },
  { id: 'littorina', from: 8500, to: 4000, cls: 'marine', lake: false },
  { id: 'post-littorina', from: 4000, to: 0, cls: 'brackish', lake: false }
];

export type EventId =
  | 'billingen-before'
  | 'billingen-after'
  | 'ancylus-max'
  | 'ancylus-regression'
  | 'littorina-onset'
  | 'littorina-max';

/** Event cross-sections (plan §1). */
export const EVENTS: readonly { id: EventId; t: number; disputed?: boolean }[] = [
  { id: 'billingen-before', t: 11750 },
  { id: 'billingen-after', t: 11650, disputed: true },
  { id: 'ancylus-max', t: 10300 },
  { id: 'ancylus-regression', t: 10050 },
  { id: 'littorina-onset', t: 8350 },
  { id: 'littorina-max', t: 6750 }
];

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
