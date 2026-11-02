/**
 * Reader for `src/assets/data/manifest.json` (`I-02b`).
 *
 * Before this, the app fetched four constant paths and trusted that whatever came back was what it
 * expected. The manifest moves two things into the data: **where the files are**, so a rename is a
 * legible error rather than an empty scene, and **what produced them** — the earth model, the
 * interpolation, τ₀ — so a readout can be interpreted at all.
 *
 * The version check is the point of the exercise. A major mismatch throws with a message the dock
 * shows, because the alternative is what `I-02`'s DoD calls out: a scene that renders nothing and
 * says nothing about why.
 *
 * Pure, no DOM and no Angular, so the Node-side tools parse the same bytes through the same code.
 */

/** Major version this reader understands; a file from another major is refused, not guessed at. */
export const MANIFEST_MAJOR = 1;

export interface ManifestFile {
  path: string;
  bytes: number;
  sha256: string;
  /** Fetched before first paint, so it counts against the first-load budget. */
  firstLoad?: boolean;
}

export interface ManifestGrid {
  path: string;
  format: string;
  quantity: 'elevation' | 'rsl' | 'ice-thickness';
  unit: string;
  datum: string;
  firstLoad?: boolean;
}

export interface Manifest {
  schemaVersion: string;
  /** Datum of the product derived from the grids — `H_paleo` and the levels drawn against it. */
  datum: string;
  gia: {
    source: string;
    earthModel: string;
    spatialInterpolation: string;
    timeInterpolation: string;
    uncertaintyModels?: readonly string[];
  };
  ice: { source: string; tau0Pa: number } | null;
  budgets: { totalBytes: number; firstLoadBytes: number };
  grids: Readonly<Record<string, ManifestGrid>>;
  files: readonly ManifestFile[];
  sources: readonly string[];
}

export class ManifestError extends Error {}

/**
 * Parses and checks the manifest. Every failure names what is wrong with it, because this runs
 * before anything is on screen and the only channel left is the message.
 */
export function parseManifest(raw: unknown): Manifest {
  const doc = raw as Partial<Manifest>;
  const version = String(doc?.schemaVersion ?? '');
  // `Number('')` is 0, not NaN, so an absent version would otherwise be reported as a major
  // mismatch — true but unhelpful when the real problem is that the field is missing.
  if (!version) throw new ManifestError('manifest.json: no schemaVersion — this is not a manifest');
  const major = Number(version.split('.')[0]);
  if (!Number.isFinite(major)) throw new ManifestError(`manifest.json: schemaVersion ${version} is not a version`);
  if (major !== MANIFEST_MAJOR) {
    throw new ManifestError(`manifest.json: schemaVersion ${version} is not ${MANIFEST_MAJOR}.x`);
  }
  if (!doc.grids || typeof doc.grids !== 'object') throw new ManifestError('manifest.json: no grids');
  if (!Array.isArray(doc.files) || !doc.files.length) throw new ManifestError('manifest.json: no files');
  if (!doc.gia?.earthModel) throw new ManifestError('manifest.json: no earth model');
  for (const [id, g] of Object.entries(doc.grids)) {
    if (!g?.path) throw new ManifestError(`manifest.json: grid ${id} has no path`);
  }
  return doc as Manifest;
}

/**
 * The grid of a given quantity, by id. The app asks for grids by what they are rather than by
 * filename — that is the whole gain of loading through the manifest.
 */
export function gridPath(m: Manifest, id: string): string {
  const g = m.grids[id];
  if (!g) throw new ManifestError(`manifest.json: no grid "${id}" (has ${Object.keys(m.grids).join(', ')})`);
  return g.path;
}

/** A published file by path, for anything that is not a KMDG grid (the ice outlines, the sills). */
export function filePath(m: Manifest, path: string): string {
  const f = m.files.find(x => x.path === path);
  if (!f) throw new ManifestError(`manifest.json: ${path} is not published`);
  return f.path;
}
