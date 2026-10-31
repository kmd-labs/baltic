export type Lang = 'en' | 'pl';

export type PhaseId = 'deglaciation' | 'bil' | 'yoldia' | 'ancylus' | 'mastogloia' | 'littorina' | 'post-littorina';

/**
 * Every user-facing text of the application in one language.
 * Add new translation keys here first so TypeScript enforces parity across en.ts and pl.ts.
 */
export interface Dict {
  htmlLang: string;
  docTitle: string;
  langName: string;

  // Top HUD & Navigation
  changeLanguage: string;
  chooseView: string;
  viewPaleo: string;
  stageAriaLabel: string;

  // Bottom Dock & Glossary
  timelineLabel: string;
  glossary: string;
  glossaryDesc: string;
  close: string;

  // Application-specific keys (add below in both en.ts and pl.ts):
  /** Readout of the shown time, e.g. "11 ka BP". */
  kaBp: (ka: number) => string;
  phases: Record<PhaseId, string>;
  legendWater: string;
  legendLand: string;
  legendIce: string;
  legendIceBand: string;
  legendCoast: string;
  prototypeNote: string;
  lakePhaseNote: string;
  dataLoading: string;
  dataError: string;
}
