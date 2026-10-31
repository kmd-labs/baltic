// I-03: every language ships the same content keys — a missing translation fails the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', '..', 'src', 'assets', 'content');
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
