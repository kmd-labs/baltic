/**
 * Shape of `src/assets/data/sources.json` (`I-04b`), as the Sources panel reads it.
 *
 * The file is generated from `SOURCES.md` by `npm run data:sources`, so this is a reader and not a
 * second place where a licence can be written down. The panel's prose stays in the content files
 * and is linked to these entries by `id`: licence text belongs to the registry, and what a dataset
 * is used *for* belongs to the translated content.
 */
export type SourceStatus = 'ok' | 'limited' | 'unresolved' | 'excluded';

export interface SourceEntry {
  id: string;
  title: string;
  ref?: string;
  licence: string;
  verified?: string;
  status: SourceStatus;
  /** Verbatim text the licence requires; the panel renders it next to the licence. */
  attribution?: string;
  /** Registered but not used anywhere yet — status speaks about the licence, not about use. */
  unused: boolean;
}

export interface SourceRegistry {
  schemaVersion: string;
  sources: readonly SourceEntry[];
  citations?: readonly { id: string; text: string }[];
  rejected?: readonly string[];
}
