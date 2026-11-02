/**
 * `V-03` — the modelled sea-level field against the 1 099 observed indicators of Rosentau et al.
 * 2021. The one quantitative validation in the plan; without it the app's claim is "agrees with
 * the syntheses", which is not a number.
 *
 * ## What is compared
 *
 * Observed relative sea level against modelled relative sea level, at the indicator's position and
 * age. Both are metres of the contemporaneous sea surface against today's local level, so no datum
 * transformation enters — which is the point: comparing the *paleo-DEM* instead would need the
 * `contemporaneous-geoid` ↔ today transformation, and that is where §0.1 and §0.2 go wrong.
 *
 * ## Two passes, for two different questions
 *
 * - **The shipped field.** Sampled from the committed cube through the app's own `rslAt` and
 *   `bilinear`, so the residuals are the app's, not a re-derivation of them. This is the number
 *   that answers "how good is what we publish".
 * - **All eight earth models.** Sampled by `tools/data/rsl_validation.py`, which needs the NetCDF
 *   originals. That table answers "is the shipped one the right choice" — `C-03` picked `sk1` by
 *   default, and a default is not a justification. The Python sampling agrees with the app's to
 *   8 mm at the same points, so the two passes are commensurable.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bilinear, rslAt } from '../../src/app/core/data/paleo.ts';
import type { RslCube } from '../../src/app/core/data/paleo.ts';

export interface Indicator {
  id: string;
  region: string;
  cluster: 'regression' | 'transgression' | 'undetermined';
  lon: number;
  lat: number;
  tBP: number;
  rslM: number;
  sigmaM: number;
  ageSigmaYr: number;
  model: Record<string, number | null>;
  sbaltic?: Record<string, number>;
}

export interface Observations {
  source: string;
  models: string[];
  sbalticModels: string[];
  indicators: Indicator[];
}

export function loadObservations(dir: string): Observations {
  return JSON.parse(readFileSync(join(dir, 'rsl-observations.json'), 'utf8')) as Observations;
}

export interface Stats {
  n: number;
  rmseM: number;
  biasM: number;
  /** Median absolute residual — the robust half, so a handful of outliers cannot pick the model. */
  madM: number;
  p90M: number;
}

export function stats(residuals: readonly number[]): Stats {
  const n = residuals.length;
  if (!n) return { n: 0, rmseM: NaN, biasM: NaN, madM: NaN, p90M: NaN };
  const abs = residuals.map(Math.abs).sort((a, b) => a - b);
  return {
    n,
    rmseM: Math.sqrt(residuals.reduce((s, x) => s + x * x, 0) / n),
    biasM: residuals.reduce((s, x) => s + x, 0) / n,
    madM: abs[Math.floor(n / 2)],
    p90M: abs[Math.floor(0.9 * (n - 1))]
  };
}

/** Residuals of the shipped cube, sampled the way the app samples it. */
export function appResiduals(cube: RslCube, indicators: readonly Indicator[]): number[] {
  return indicators.map(i => bilinear(rslAt(cube, i.tBP / 1000), cube.geometry, i.lon, i.lat) - i.rslM);
}

/** Residuals of one earth model from the pre-sampled table. */
export function modelResiduals(indicators: readonly Indicator[], model: string): number[] {
  const out: number[] = [];
  for (const i of indicators) {
    const v = i.model[model];
    if (v != null) out.push(v - i.rslM);
  }
  return out;
}

export function groupBy<K extends keyof Indicator>(
  indicators: readonly Indicator[],
  key: K,
  residuals: readonly number[]
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  indicators.forEach((i, k) => {
    const g = String(i[key]);
    if (!out.has(g)) out.set(g, []);
    out.get(g)!.push(residuals[k]);
  });
  return out;
}

/**
 * Acceptance threshold on the shipped field's RMSE, and the reasoning rather than a round number.
 *
 * The field is 1° (about 60 km of latitude) and the measured step between adjacent nodes inside the
 * Baltic window reaches 85 m in the early Holocene, with a p95 of 52 m (audit B3, reproduced by
 * `npm run audit:metrics`). An interpolation across a node spacing whose own gradient is tens of
 * metres cannot place sea level to better than roughly a fifth of that step, which puts the
 * expected error in the 10–20 m range before any question of the rheology. 20 m is therefore the
 * threshold: it is where "the field is being used outside what its resolution supports" begins, and
 * all eight models currently sit between 11.6 and 15.0.
 *
 * It is not a goal. The goal is a finer field, and this number is what says how far that would be
 * worth going.
 */
export const RMSE_BUDGET_M = 20;
