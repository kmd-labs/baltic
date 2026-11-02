/** Fixed places on the globe. Names come from the content files. */

export type PlaceId = 'stockholm' | 'helsinki' | 'tallinn' | 'riga' | 'gdansk' | 'copenhagen' | 'umea' | 'oulu' | 'szczecin' | 'gotland';

export const PLACES: readonly { id: PlaceId; lon: number; lat: number }[] = [
  { id: 'stockholm', lon: 18.07, lat: 59.33 },
  { id: 'helsinki', lon: 24.94, lat: 60.17 },
  { id: 'tallinn', lon: 24.75, lat: 59.44 },
  { id: 'riga', lon: 24.1, lat: 56.95 },
  { id: 'gdansk', lon: 18.65, lat: 54.35 },
  { id: 'copenhagen', lon: 12.57, lat: 55.68 },
  { id: 'umea', lon: 20.26, lat: 63.83 },
  { id: 'oulu', lon: 25.47, lat: 65.01 },
  { id: 'szczecin', lon: 14.55, lat: 53.43 },
  { id: 'gotland', lon: 18.5, lat: 57.45 }
];

/**
 * Sills used to live here as six positions. They come from `src/assets/data/sills.json` now
 * (`C-05`), where each one carries its threshold elevation, its periods, its per-phase state, its
 * sources and a hypothesis flag — read through `sills.ts`, exposed as `PaleoDataService.sills()`.
 *
 * The move is the point of the issue rather than tidying: the catalogue is what `V-02` checks the
 * model's spill route against, and a bare list of names could not say where its numbers came from.
 */
