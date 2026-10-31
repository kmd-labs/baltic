export type Lang = 'en' | 'pl';

export type TourStepId = 'play' | 'layers' | 'glossary' | 'sources' | 'phase' | 'transect' | 'about';

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
  stageAriaLabel: string;

  // Bottom Dock & Glossary
  timelineLabel: string;
  glossary: string;
  glossaryDesc: string;
  close: string;

  // Application-specific keys (add below in both en.ts and pl.ts):
  /** Locale for numbers, e.g. "pl-PL". */
  numberLocale: string;
  /** "11 650 cal BP" */
  calBp: (t: string) => string;
  /** Calendar year of a cal BP age, e.g. "≈ 9 700 p.n.e." */
  calendar: (year: number, fmt: (n: number) => string) => string;
  prototype: string;
  play: string;
  pause: string;
  prevFrame: string;
  nextFrame: string;
  collapsePanels: string;
  expandPanels: string;
  layersLabel: string;
  tour: string;
  tourNext: string;
  tourPrev: string;
  tourDone: string;
  tourClose: string;
  tourStepOf: (i: number, n: number) => string;
  tourSteps: Record<TourStepId, { title: string; text: string }>;
  layerIce: string;
  layerBand: string;
  layerToday: string;
  layerPrev: string;
  layerSills: string;
  layerTransect: string;
  layerLabels: string;
  zoomIn: string;
  zoomOut: string;
  zoomFit: string;
  sources: string;
  srcUse: string;
  srcOrigin: string;
  srcLicence: string;
  srcNote: string;
  about: string;
  aboutTitle: string;
  panelsLabel: string;
  tabPhase: string;
  tabTransect: string;
  phaseTitle: string;
  phaseEvents: string;
  badgeModelled: string;
  badgeInterpolated: string;
  badgeIceNearest: string;
  badgeDatum: string;
  badgeDisputed: string;
  badgePsu: (range: string) => string;
  indicatorSpecies: string;
  kvLevel: string;
  levelOcean: string;
  levelConnected: string;
  levelIsolated: string;
  levelLake: (m: string) => string;
  levelLiterature: string;
  kvLevelModel: string;
  kvLevelLit: string;
  levelMatch: string;
  levelMismatch: (m: string) => string;
  levelSill: string;
  kvArea: string;
  kvVolume: string;
  kvMaxDepth: string;
  areaValue: (thousandKm2: string) => string;
  volumeValue: (thousandKm3: string) => string;
  transectTitle: string;
  transectFloor: string;
  transectToday: string;
  transectIce: string;
  transectWater: string;
  transectMetaOcean: string;
  transectMetaLake: (m: string) => string;
  transectAria: string;
  tipIce: string;
  tipOcean: string;
  tipLake: string;
  tipLand: string;
  tipSeabed: string;
  tipRelOcean: string;
  tipToday: string;
  tipRsl: string;
  dataLoading: string;
  dataError: string;
}
