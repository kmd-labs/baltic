import type { PhaseId } from '../i18n/i18n.types';

/**
 * Basin-wide phase boundaries in cal ka BP (plan §2, Andrén et al. 2011).
 * Temporary: replaced by timeline.json once C-08 lands.
 */
export const PHASES: readonly { id: PhaseId; startKa: number; endKa: number; lake: boolean }[] = [
  { id: 'deglaciation', startKa: 20, endKa: 16, lake: false },
  { id: 'bil', startKa: 16, endKa: 11.7, lake: true },
  { id: 'yoldia', startKa: 11.7, endKa: 10.7, lake: false },
  { id: 'ancylus', startKa: 10.7, endKa: 9.8, lake: true },
  { id: 'mastogloia', startKa: 9.8, endKa: 8.5, lake: false },
  { id: 'littorina', startKa: 8.5, endKa: 4, lake: false },
  { id: 'post-littorina', startKa: 4, endKa: 0, lake: false }
];

export function phaseAt(ka: number): (typeof PHASES)[number] {
  return PHASES.find(p => ka <= p.startKa && ka > p.endKa) ?? PHASES[PHASES.length - 1];
}
