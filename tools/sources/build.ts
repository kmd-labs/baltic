/**
 * Builds `src/assets/data/sources.json` from `SOURCES.md` (`I-04b`).
 *
 *   npm run data:sources
 *   npm run data:sources -- --report
 *
 * ## What is generated and what is not
 *
 * `SOURCES.md` is the repo's single source of truth for licences, and until now the Sources panel
 * retyped them: the panel's GEBCO line was a paraphrase of the registry's, which is exactly how a
 * licence statement goes stale. So the **machine-readable half** — id, licence, verification,
 * status, DOI and the attribution text the licence requires — is generated from the registry and
 * cannot drift from it.
 *
 * The panel's **prose** stays in `src/assets/content/{en,pl}` and is keyed by the same ids. That is
 * not a compromise: what each dataset is used *for* is bilingual UI text, which `I-03` puts in the
 * content files by design, and moving it into a licence registry would make the registry
 * untranslatable. The two halves are held together by `tests/contract/sources.test.ts`: every id
 * the panel describes must exist in the registry, and every source the published data actually
 * cites must be described.
 *
 * The parser reads the two forms `SOURCES.md` uses — a table row whose first cell is a backticked
 * id, and an attribution bullet that starts with one. Anything it cannot place is reported rather
 * than dropped, since a silently skipped row is a licence that never reaches the panel.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA } from '../lib/frames.ts';

const ROOT = join(DATA, '..', '..', '..');
const MD = join(ROOT, 'SOURCES.md');

export type SourceStatus = 'ok' | 'limited' | 'unresolved' | 'excluded';

export interface SourceEntry {
  id: string;
  /** Dataset title as the registry names it, stripped of markdown. */
  title: string;
  /** DOI or URL, when the registry gives one. */
  ref?: string;
  licence: string;
  /** Where and when the licence was verified. */
  verified?: string;
  status: SourceStatus;
  /** Verbatim attribution text, where the licence requires one. */
  attribution?: string;
  /** True while the registry marks the entry as registered but not yet used. */
  unused: boolean;
}

const STATUS: Record<string, SourceStatus> = { '✅': 'ok', '⚠️': 'limited', '❓': 'unresolved', '⛔': 'excluded' };

/** Markdown emphasis and links out, text in — the panel renders plain strings. */
function plain(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSourcesMd(md: string): {
  entries: SourceEntry[];
  rejected: string[];
  citations: { id: string; text: string }[];
  unparsed: string[];
} {
  const entries: SourceEntry[] = [];
  const rejected: string[] = [];
  const citations: { id: string; text: string }[] = [];
  const unparsed: string[] = [];
  const attributions = new Map<string, string>();
  let section: 'registry' | 'rejected' | 'citations' = 'registry';

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      // Three kinds of table live in this document and only one of them is a licence registry.
      section = /Odrzucone/i.test(line) ? 'rejected' : /Literatura cytowana/i.test(line) ? 'citations' : 'registry';
    }

    const bullet = /^-\s*`([a-z0-9_]+)`\s*[—-]\s*(.+)$/.exec(line);
    if (bullet) {
      attributions.set(bullet[1], plain(bullet[2]));
      continue;
    }

    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    const id = /^`([a-z0-9_]+)`$/.exec(cells[0])?.[1];
    if (!id) continue;
    if (section === 'rejected') {
      rejected.push(id);
      continue;
    }
    if (section === 'citations') {
      // Publications whose *numbers* enter the contract (phase boundaries, sill elevations). Facts
      // are not copyrightable, so these carry a citation rather than a licence.
      citations.push({ id, text: plain(cells[1]) });
      continue;
    }
    // Registry rows are: id | dataset | ref | licence | verification | status
    if (cells.length < 6) {
      unparsed.push(`${id}: ${cells.length} cells`);
      continue;
    }
    const statusCell = cells[5];
    const mark = Object.keys(STATUS).find(k => statusCell.startsWith(k));
    if (!mark) {
      unparsed.push(`${id}: status cell "${statusCell.slice(0, 20)}"`);
      continue;
    }
    const ref = plain(cells[2]);
    entries.push({
      id,
      title: plain(cells[1]),
      ...(ref && ref !== '—' ? { ref } : {}),
      licence: plain(cells[3]),
      ...(plain(cells[4]) && plain(cells[4]) !== '—' ? { verified: plain(cells[4]) } : {}),
      status: STATUS[mark],
      unused: /nieużywany/.test(statusCell),
    });
  }

  for (const e of entries) {
    const a = attributions.get(e.id);
    if (a) e.attribution = a;
  }
  return {
    entries: entries.sort((a, b) => a.id.localeCompare(b.id)),
    rejected: rejected.sort(),
    citations: citations.sort((a, b) => a.id.localeCompare(b.id)),
    unparsed,
  };
}

const { entries, rejected, citations, unparsed } = parseSourcesMd(readFileSync(MD, 'utf8'));

console.log('\nsources.json — from SOURCES.md\n');
console.log(
  `  ${entries.length} registered, ${citations.length} cited publications, ${rejected.length} rejected, ${unparsed.length} unparsed`
);
for (const e of entries) {
  console.log(
    `  ${e.status === 'ok' ? '✓' : e.status === 'limited' ? '~' : '✗'} ${e.id.padEnd(24)} ${e.unused ? 'unused ' : '       '}${e.licence.slice(0, 48)}`
  );
}
if (unparsed.length) {
  console.error(`\n✗ rows the parser could not place:\n  ${unparsed.join('\n  ')}`);
  process.exit(1);
}

const doc = {
  schemaVersion: '1.4.0',
  $comment: 'Generated by npm run data:sources from SOURCES.md. Panel prose lives in assets/content.',
  sources: entries,
  citations,
  rejected,
};

if (process.argv.includes('--report')) {
  console.log('\n--report: nothing written\n');
} else {
  writeFileSync(join(DATA, 'sources.json'), JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`\nwrote ${join(DATA, 'sources.json')}\n`);
}
