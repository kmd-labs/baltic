import { Dict } from './i18n.types';

export const PL: Dict = {
  htmlLang: 'pl',
  docTitle: 'KMD · Baltic',
  langName: 'Polski',

  // Top HUD & Navigation
  changeLanguage: 'Język',
  chooseView: 'Widok',
  viewPaleo: 'Paleogeografia',
  stageAriaLabel: 'Glob wycentrowany na Bałtyku: woda, ląd i lądolód w wybranym czasie',

  // Bottom Dock & Glossary
  timelineLabel: 'Oś czasu',
  glossary: 'Słowniczek',
  glossaryDesc: '',
  close: 'Zamknij',

  // Application-specific keys:
  kaBp: ka => `${Number.isInteger(ka) ? ka : ka.toFixed(1).replace('.', ',')} tys. lat BP`,
  phases: {
    deglaciation: 'Deglacjacja',
    bil: 'Bałtyckie Jezioro Lodowe',
    yoldia: 'Morze Yoldiowe',
    ancylus: 'Jezioro Ancylusowe',
    mastogloia: 'Morze Mastogloiowe',
    littorina: 'Morze Litorynowe',
    'post-littorina': 'Bałtyk politorynowy'
  },
  legendWater: 'Woda',
  legendLand: 'Ląd',
  legendIce: 'Lądolód',
  legendIceBand: 'Niepewność lądolodu',
  legendCoast: 'Brzeg dziś',
  prototypeNote: 'Prototyp · H_dziś − RSL(t), Steffen i Kaufmann 2025 (sk1) · jeszcze bez flood-fill',
  lakePhaseNote: 'Faza jeziorna: poziom wyznaczał próg odpływu, nie ocean — tu pokazany na poziomie oceanu',
  dataLoading: 'Wczytywanie danych…',
  dataError: 'Nie udało się wczytać danych paleo'
};
