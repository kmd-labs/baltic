// I-03: every language ships the same content keys — a missing translation fails the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', '..', 'src', 'assets', 'content');
const DATA = join(import.meta.dirname, '..', '..', 'src', 'assets', 'data');
const langs = readdirSync(DIR);

function shape(v: unknown, path = ''): string[] {
  if (Array.isArray(v)) return [`${path}[${v.length}]`, ...v.flatMap((x, i) => shape(x, `${path}[${i}]`))];
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => [`${path}.${k}`, ...shape(x, `${path}.${k}`)]);
  return [];
}

test('content files exist for en and pl', () => {
  assert.ok(langs.includes('en') && langs.includes('pl'), `found ${langs.join(', ')}`);
});

for (const file of readdirSync(join(DIR, 'en'))) {
  test(`${file}: same keys and list lengths in every language`, () => {
    const ref = shape(JSON.parse(readFileSync(join(DIR, 'en', file), 'utf8')));
    for (const lang of langs) {
      const got = shape(JSON.parse(readFileSync(join(DIR, lang, file), 'utf8')));
      assert.deepEqual(got, ref, `${lang}/${file} differs from en/${file}`);
    }
  });

  test(`${file}: no empty strings`, () => {
    for (const lang of langs) {
      const walk = (v: unknown, p: string): void => {
        if (typeof v === 'string') assert.ok(v.trim().length > 0, `${lang}/${file} ${p} is empty`);
        else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, `${p}.${k}`));
      };
      walk(JSON.parse(readFileSync(join(DIR, lang, file), 'utf8')), '');
    }
  });
}

// Since `C-05` the sill ids are data rather than a union in the code — `geo.ts` used to hold the
// ids and the positions together, and the union was what kept a sill from reaching the screen as a
// bare slug. The check it was doing has to live somewhere, so it lives here.
test('every sill in sills.json has a label in every language', () => {
  const catalogue = JSON.parse(readFileSync(join(DATA, 'sills.json'), 'utf8')) as { sills: { id: string }[] };
  assert.ok(catalogue.sills.length > 0, 'sills.json is empty');
  for (const lang of langs) {
    const content = JSON.parse(readFileSync(join(DIR, lang, 'postglacial.json'), 'utf8')) as {
      sills: Record<string, string>;
    };
    for (const { id } of catalogue.sills) {
      assert.ok(content.sills[id], `${lang}/postglacial.json has no label for sill "${id}"`);
    }
  }
});

// I-03b: no user-facing text outside the dictionaries and the content files.
//
// Dict completeness is TypeScript's job — `en.ts` and `pl.ts` are typed as `Dict`, so a missing key
// fails the build. Content parity is the tests above. What neither catches is a literal written
// straight into a template, which is how every one of these got in. The two forms below are narrow
// enough to carry no false positives and cover what actually regressed: an accessibility label
// someone typed in English, and a unit someone appended next to an interpolation.
//
// Markup only: a whole `.html` file, and for a component the body of its inline `template:`.
// Scanning a whole `.ts` would trip over prose in comments, which is not what ships.
const TEMPLATES: readonly { name: string; markup: string }[] = (function collect(dir: string) {
  const out: { name: string; markup: string }[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...collect(p));
      continue;
    }
    if (!e.isFile()) continue;
    if (e.name.endsWith('.html')) out.push({ name: e.name, markup: readFileSync(p, 'utf8') });
    else if (e.name.endsWith('.component.ts')) {
      const m = /\r?\n\s*template:\s*`([\s\S]*?)`,\r?\n/.exec(readFileSync(p, 'utf8'));
      if (m) out.push({ name: e.name, markup: m[1] });
    }
  }
  return out;
})(join(import.meta.dirname, '..', '..', 'src', 'app'));

test('the scan found the templates it is meant to guard', () => {
  // A regex that silently matched nothing would make both checks below vacuous.
  assert.ok(TEMPLATES.length >= 5, `found only ${TEMPLATES.length} templates`);
  assert.ok(
    TEMPLATES.some(t => t.name === 'app.component.html') && TEMPLATES.some(t => t.name === 'phase-card.component.ts'),
    `collected: ${TEMPLATES.map(t => t.name).join(', ')}`
  );
});

test('no literal aria-label or title in a template', () => {
  // `alt="KMD"` is the brand mark on the logotype, the same in every language.
  const allowed = new Set(['KMD']);
  for (const { name, markup } of TEMPLATES) {
    for (const m of markup.matchAll(/(?<!\[attr\.)\b(aria-label|title|alt)="([^"{}]*[A-Za-z]{2}[^"{}]*)"/g)) {
      assert.ok(allowed.has(m[2].trim()), `${name}: ${m[1]}="${m[2]}" is a literal — bind it to the dictionary`);
    }
  }
});

test('no unit literals pasted next to an interpolation', () => {
  // `cal BP` and ` ka` both lived in templates as suffixes on a formatted number. They are
  // `tr.calBp` and `tr.unitKa` now, and another language renders them through those.
  for (const { name, markup } of TEMPLATES) {
    for (const unit of ['cal BP', "' ka'", '" ka"']) {
      assert.ok(!markup.includes(unit), `${name} still carries the literal ${unit}`);
    }
  }
});
