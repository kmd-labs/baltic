/**
 * The sill catalogue (`C-05`), as the app reads it from `src/assets/data/sills.json`.
 *
 * Until now the catalogue was six hard-coded positions in `geo.ts`, and `V-02` compared the
 * model's spill route against them. The comparison is the point — it is what found that the model
 * drains the Yoldia-window basin 97 km from the nearest named sill, and that Svea never controls
 * (audit II.2 B2) — but it is only worth running against a catalogue that carries its sources,
 * its periods and its hypothesis flags. That is the file; this is its reader.
 *
 * Pure, no DOM and no Angular, so the Node-side tools and the contract tests parse the same bytes
 * through the same code as the browser.
 */
/** Major version this reader understands. A file from another major is refused, not guessed at. */
export const SILLS_MAJOR = 1;

/** The least a catalogue entry has to be: an id and a place. What `sill-check.ts` needs of one. */
export interface SillPoint {
  id: string;
  lon: number;
  lat: number;
}

export type SillState = 'open' | 'closed';

export interface SillEntry extends SillPoint {
  /** Present-day elevation at the position, metres. See the file's `method`. */
  elevationM: number;
  /** Dated periods from the literature. Empty means "no dated source", not "never active". */
  activePeriods: readonly { fromBP: number; toBP: number }[];
  /** Open / closed per phase id, measured on the model. */
  states: Readonly<Record<string, SillState>>;
  /** The entry is a hypothesis — a route the model uses, not an established sill. */
  hypothesis: boolean;
  sources: readonly string[];
}

export interface SillCatalogue {
  schemaVersion: string;
  datum: string;
  /** How the file's numbers were obtained; optional in the contract, shown in the Sources panel. */
  method?: string;
  sills: readonly SillEntry[];
}

/**
 * Parses and checks the catalogue. Throws with a legible message rather than letting a shape
 * mismatch surface later as an empty panel — `I-02`'s rule for every asset the app loads.
 */
export function parseSills(raw: unknown): SillCatalogue {
  const doc = raw as Partial<SillCatalogue>;
  const major = Number(String(doc?.schemaVersion ?? '').split('.')[0]);
  if (major !== SILLS_MAJOR) {
    throw new Error(`sills.json: schemaVersion ${doc?.schemaVersion} is not ${SILLS_MAJOR}.x`);
  }
  if (!Array.isArray(doc.sills) || !doc.sills.length) throw new Error('sills.json: no sills');
  for (const s of doc.sills) {
    if (typeof s.id !== 'string' || !Number.isFinite(s.lon) || !Number.isFinite(s.lat)) {
      throw new Error(`sills.json: entry ${JSON.stringify(s?.id)} has no usable position`);
    }
  }
  return doc as SillCatalogue;
}

const DEG = Math.PI / 180;

/**
 * Great-circle-ish distance in km, flat enough for the Baltic window. One definition, used by the
 * sill-check and by whatever resolves a spill route to a catalogue name, so the two never disagree
 * about which entry is nearest.
 */
export function distKm(aLon: number, aLat: number, bLon: number, bLat: number): number {
  return Math.hypot((bLon - aLon) * Math.cos(((aLat + bLat) / 2) * DEG) * 111.32, (bLat - aLat) * 110.57);
}

/** The catalogue entry nearest a position, with the distance to it. Null for an empty catalogue. */
export function nearestSill<T extends SillPoint>(
  sills: readonly T[],
  lon: number,
  lat: number
): { sill: T; km: number } | null {
  let best: { sill: T; km: number } | null = null;
  for (const s of sills) {
    const km = distKm(lon, lat, s.lon, s.lat);
    if (!best || km < best.km) best = { sill: s, km };
  }
  return best;
}
