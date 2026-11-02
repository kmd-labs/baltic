// C-08: the chronology is data with citations, not seven hard-coded rows.
//
// `timeline.json` is the source — `timeline.ts` imports it — so there is nothing here to check two
// copies against. What is worth checking is that the file's own claims hang together, and above all
// that its citations resolve: "every boundary with a citation" is decoration unless something fails
// when a source id is not registered in SOURCES.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVENTS, FRAMES, LOCAL_ONSETS, PHASES, eventAt, phaseAt } from '../../src/app/core/data/timeline.ts';
import { parseSills } from '../../src/app/core/data/sills.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const DATA = join(ROOT, 'src', 'assets', 'data');

interface Boundary {
  tBP: number;
  sources: string[];
}
interface TimelineDoc {
  schemaVersion: string;
  method?: string;
  phases: {
    id: string;
    start: Boundary;
    end: Boundary;
    localOnsets?: { place: string; lat: number; lon: number; tBP: number; sources: string[] }[];
  }[];
  events: { id: string; tBP: number; stageId?: string; disputed?: boolean; sources: string[] }[];
}

const doc = JSON.parse(readFileSync(join(DATA, 'timeline.json'), 'utf8')) as TimelineDoc;

/**
 * Source ids registered in SOURCES.md, which the repo calls its single source of truth. Taken from
 * the first cell of a table row and from the head of a citation bullet, the two forms the document
 * uses, so a backticked word in prose cannot pass for a registration.
 */
function registeredSources(): Set<string> {
  const md = readFileSync(join(ROOT, 'SOURCES.md'), 'utf8');
  const ids = new Set<string>();
  for (const line of md.split(/\r?\n/)) {
    const row = /^\|\s*`([a-z0-9_]+)`\s*\|/.exec(line);
    const bullet = /^-\s*`([a-z0-9_]+)`\s*[—-]/.exec(line);
    if (row) ids.add(row[1]);
    if (bullet) ids.add(bullet[1]);
  }
  return ids;
}

test('every citation in the contract files resolves to a source registered in SOURCES.md', () => {
  const known = registeredSources();
  assert.ok(known.size > 15, `only ${known.size} sources parsed out of SOURCES.md`);

  const cited: [string, string[]][] = [];
  for (const p of doc.phases) {
    cited.push([`${p.id}.start`, p.start.sources], [`${p.id}.end`, p.end.sources]);
    for (const o of p.localOnsets ?? []) cited.push([`${p.id}.onset.${o.place}`, o.sources]);
  }
  for (const e of doc.events) cited.push([`event.${e.id}`, e.sources]);
  for (const s of parseSills(JSON.parse(readFileSync(join(DATA, 'sills.json'), 'utf8'))).sills) {
    cited.push([`sill.${s.id}`, [...s.sources]]);
  }

  for (const [where, sources] of cited) {
    assert.ok(sources.length > 0, `${where} has no citation`);
    for (const id of sources) {
      assert.ok(known.has(id), `${where} cites "${id}", which is not registered in SOURCES.md`);
    }
  }
});

test('the seven phases tile the window without a gap or an overlap', () => {
  assert.equal(doc.phases.length, 7);
  assert.equal(PHASES[0].from, 20000, 'the window opens at 20 ka');
  assert.equal(PHASES[PHASES.length - 1].to, 0, 'and closes at the present');
  for (const p of PHASES) assert.ok(p.from > p.to, `${p.id}: ${p.from} is not older than ${p.to}`);
  for (let i = 1; i < PHASES.length; i++) {
    assert.equal(PHASES[i].from, PHASES[i - 1].to, `gap between ${PHASES[i - 1].id} and ${PHASES[i].id}`);
  }
});

test('the end of the Ancylus phase is Andrén 9 800, not an average with 9 500', () => {
  // The DoD's "zero averaged boundaries", as a check rather than a promise. 9 650 is what averaging
  // the two published figures would give, and it is the one value this boundary must never hold.
  const ancylus = doc.phases.find(p => p.id === 'ancylus');
  assert.ok(ancylus);
  assert.equal(ancylus.end.tBP, 9800);
  assert.notEqual(ancylus.end.tBP, 9650);
  assert.ok(doc.method?.includes('9 500'), 'the divergence has to be stated, not silently dropped');
});

test('each event declares the phase it actually falls in', () => {
  // stageId is written out in the file and could disagree with the boundaries beside it; phaseAt is
  // what the app uses to decide. A mismatch would put an event under the wrong phase card.
  for (const e of doc.events) {
    if (!e.stageId) continue;
    assert.equal(phaseAt(e.tBP).id, e.stageId, `event ${e.id} at ${e.tBP} BP is in ${phaseAt(e.tBP).id}`);
  }
  assert.equal(EVENTS.length, doc.events.length);
  for (const e of EVENTS) assert.ok(FRAMES.includes(e.t), `${e.id} at ${e.t} BP is not a frame`);
});

test('the disputed flag survives the trip from the file to the module', () => {
  const after = eventAt(11650);
  assert.ok(after, 'the final Billingen drainage is an event cross-section');
  assert.equal(after.disputed, true, 'its duration is one estimate, not a consensus');
  assert.equal(eventAt(10300)?.disputed, undefined, 'and the Ancylus maximum is not flagged');
});

test('local onsets stay apart from the basin-wide boundary', () => {
  // The reason the field exists (C-08, and V-06 #45): the Littorina onset in the Little Belt is
  // about a millennium younger than the boundary. An onset that equalled its boundary would mean
  // the distinction had been quietly collapsed.
  assert.ok(LOCAL_ONSETS.length > 0, 'at least the Little Belt onset is recorded');
  for (const o of LOCAL_ONSETS) {
    const phase = PHASES.find(p => p.id === o.phase);
    assert.ok(phase, `onset ${o.place} names an unknown phase ${o.phase}`);
    assert.notEqual(o.tBP, phase.from, `onset ${o.place} is just a copy of the ${o.phase} boundary`);
    assert.ok(o.tBP < phase.from, `onset ${o.place} at ${o.tBP} BP predates the ${o.phase} boundary`);
  }
  const littleBelt = LOCAL_ONSETS.find(o => o.place === 'little-belt');
  assert.ok(littleBelt);
  assert.equal(littleBelt.tBP, 7400);
  assert.equal(littleBelt.phase, 'littorina');
});
