import { Dict } from './i18n.types';

export const EN: Dict = {
  htmlLang: 'en',
  docTitle: 'KMD · Baltic',
  langName: 'English',

  // Top HUD & Navigation
  changeLanguage: 'Language',
  chooseView: 'View',
  viewPaleo: 'Paleogeography',
  stageAriaLabel: 'Globe centred on the Baltic Sea showing water, land and ice at the selected time',

  // Bottom Dock & Glossary
  timelineLabel: 'Timeline',
  glossary: 'Glossary',
  glossaryDesc: '',
  close: 'Close',

  // Application-specific keys:
  kaBp: ka => `${Number.isInteger(ka) ? ka : ka.toFixed(1)} ka BP`,
  phases: {
    deglaciation: 'Deglaciation',
    bil: 'Baltic Ice Lake',
    yoldia: 'Yoldia Sea',
    ancylus: 'Ancylus Lake',
    mastogloia: 'Mastogloia Sea',
    littorina: 'Littorina Sea',
    'post-littorina': 'Post-Littorina Baltic'
  },
  legendWater: 'Water',
  legendLand: 'Land',
  legendIce: 'Ice sheet',
  legendIceBand: 'Ice uncertainty',
  legendCoast: 'Coast today',
  prototypeNote: 'Prototype · H_now − RSL(t), Steffen & Kaufmann 2025 (sk1) · no flood-fill yet',
  lakePhaseNote: 'Lake phase: the real level was set by the outlet sill, not the ocean — shown here at ocean level',
  dataLoading: 'Loading data…',
  dataError: 'Could not load the paleo data'
};
