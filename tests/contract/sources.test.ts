// I-04b: the Sources panel and the licence registry describe the same world.
//
// SOURCES.md is the repo's single source of truth for licences. The panel used to retype them —
// its GEBCO line was a paraphrase of the registry's — which is how a licence statement drifts from
// the document meant to govern it. sources.json is now generated from the registry and the panel
// renders that; the prose stays in the content files because it is translated UI text.
//
// What these tests hold is the seam between the two halves: that every described dataset exists in
// the registry, and that every source the published data actually cites is described to the reader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSourcesMd } from '../../tools/sources/build.ts';
import type { SourceRegistry } from '../../src/app/core/data/sources.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const DATA = join(ROOT, 'src', 'assets', 'data');
const registry = JSON.parse(readFileSync(join(DATA, 'sources.json'), 'utf8')) as SourceRegistry;
const content = (lang: string) =>
  JSON.parse(readFileSync(join(ROOT, 'src', 'assets', 'content', lang, 'postglacial.json'), 'utf8')) as {
    sources: { sourceId: string | null; name: string; use: string; origin: string; note: string }[];
  };

test('sources.json is what SOURCES.md says, not an edited copy of it', () => {
  const parsed = parseSourcesMd(readFileSync(join(ROOT, 'SOURCES.md'), 'utf8'));
  assert.equal(parsed.unparsed.length, 0, `rows the parser could not place: ${parsed.unparsed.join('; ')}`);
  assert.deepEqual(
    registry.sources.map(s => s.id),
    parsed.entries.map(e => e.id),
    'sources.json is out of date — run npm run data:sources'
  );
  for (const e of parsed.entries) {
    const shipped = registry.sources.find(s => s.id === e.id);
    assert.equal(shipped?.licence, e.licence, `${e.id}: licence differs from the registry`);
    assert.equal(shipped?.status, e.status, `${e.id}: status differs from the registry`);
  }
});

test('nothing with an unresolved or excluded licence is published', () => {
  // SOURCES.md's own rule (0-02, 0-03): a licence we cannot read is a licence we cannot comply
  // with. After 0-03 there should be no such entry left in the registry at all.
  for (const s of registry.sources) {
    assert.ok(['ok', 'limited'].includes(s.status), `${s.id} is ${s.status} and still in sources.json`);
  }
  assert.ok((registry.rejected ?? []).length >= 8, 'the rejected list is the record of what was considered');
});

test('every licence that demands attribution carries its verbatim text', () => {
  // "Demands" has to be read from the licence, not guessed from the word appearing in it: Natural
  // Earth is public domain and says attribution is *optional* ("atrybucja nieobowiązkowa"), so
  // requiring text there would be the test inventing an obligation the licence disclaims.
  const demandsAttribution = (licence: string) =>
    !/nieobowiązkow|not required|optional/i.test(licence) &&
    /CC BY|obowiązkiem atrybucji|attribution required/i.test(licence);

  for (const s of registry.sources) {
    if (!demandsAttribution(s.licence)) continue;
    assert.ok(s.attribution && s.attribution.length > 30, `${s.id} requires attribution and has none`);
  }
  // And the predicate is not vacuous: the CC BY datasets are the backbone of the reconstruction.
  const required = registry.sources.filter(s => demandsAttribution(s.licence));
  assert.ok(required.length >= 6, `only ${required.length} sources were found to require attribution`);
});

test('the panel describes every dataset the published data actually uses', () => {
  // "Used" is the registry's own judgement: an entry not marked `unused`. A dataset whose numbers
  // reach the screen with no entry in the panel is the gap I-04 existed to close.
  const described = new Set(content('en').sources.map(s => s.sourceId).filter(Boolean));
  for (const s of registry.sources) {
    if (s.unused) continue;
    assert.ok(described.has(s.id), `${s.id} is in use and the Sources panel does not mention it`);
  }
});

test('the panel never points at a source that does not exist', () => {
  const ids = new Set(registry.sources.map(s => s.id));
  for (const lang of ['en', 'pl']) {
    const entries = content(lang).sources;
    for (const e of entries) {
      if (e.sourceId) assert.ok(ids.has(e.sourceId), `${lang}: entry "${e.name}" points at unknown ${e.sourceId}`);
      // The licence is no longer prose: it must not have crept back into the content files.
      assert.ok(!('licence' in e), `${lang}: "${e.name}" carries a licence field again`);
    }
    assert.deepEqual(
      entries.map(e => e.sourceId),
      content('en').sources.map(e => e.sourceId),
      `${lang} links its entries to different sources than en`
    );
  }
});
