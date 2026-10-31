/** Fixed places on the globe. Names come from the content files. */

export type PlaceId = 'stockholm' | 'helsinki' | 'tallinn' | 'riga' | 'gdansk' | 'copenhagen' | 'umea' | 'oulu' | 'szczecin' | 'gotland';
export type SillId = 'billingen' | 'narke' | 'svea' | 'darss' | 'oresund' | 'storebaelt';

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
 * Sill and strait positions (plan §3.2 / C-05). States and threshold elevations come with
 * sills.json; until then the globe shows positions only.
 */
export const SILLS: readonly { id: SillId; lon: number; lat: number }[] = [
  { id: 'billingen', lon: 13.85, lat: 58.45 },
  { id: 'narke', lon: 15.3, lat: 59.22 },
  { id: 'svea', lon: 14.45, lat: 59.2 },
  { id: 'darss', lon: 12.25, lat: 54.6 },
  { id: 'oresund', lon: 12.75, lat: 55.55 },
  { id: 'storebaelt', lon: 11.0, lat: 55.3 }
];
