// Reads the KMDG fixtures written by tools/data/kmdg.py and checks every value.
//   npm run test:contract
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { decodeKmdg, gunzipIfNeeded, kmdgLayer, kmdgValue, KmdgError } from '../../src/app/core/data/kmdg.ts';

const DIR = join(import.meta.dirname, '..', '..', 'contract', 'fixtures', 'grid');
const names = readdirSync(DIR).filter(f => f.endsWith('.kmdg.gz')).map(f => f.replace('.kmdg.gz', ''));

const toArrayBuffer = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

test('fixtures exist', () => {
  assert.ok(names.length >= 3, `expected at least 3 grid fixtures, found ${names.length}`);
});

for (const name of names) {
  test(`${name}: header and every value match the Python writer`, async () => {
    const buf = await gunzipIfNeeded(toArrayBuffer(readFileSync(join(DIR, `${name}.kmdg.gz`))));
    const g = decodeKmdg(buf);
    const exp = JSON.parse(readFileSync(join(DIR, `${name}.expected.json`), 'utf8'));
    assert.equal(g.nx, exp.nx);
    assert.equal(g.ny, exp.ny);
    assert.equal(g.nt, exp.nt);
    assert.deepEqual([...g.bbox], exp.bbox);
    exp.times.forEach((t: number, i: number) => assert.ok(Math.abs(g.times[i] - t) < 1e-4));
    for (let t = 0; t < g.nt; t++) {
      const layer = kmdgLayer(g, t);
      for (let r = 0; r < g.ny; r++) {
        for (let c = 0; c < g.nx; c++) {
          const want = exp.values[t][r][c];
          const got = kmdgValue(g, t, r, c);
          if (want === null) {
            assert.ok(Number.isNaN(got), `${name}[${t},${r},${c}] should be nodata`);
          } else {
            assert.ok(Math.abs(got - want) < 1e-6, `${name}[${t},${r},${c}]: ${got} != ${want}`);
            assert.ok(Math.abs(layer[r * g.nx + c] - want) < 1e-3 * Math.max(1, Math.abs(want)));
          }
        }
      }
    }
  });
}

test('rejects a truncated or foreign buffer', async () => {
  const buf = await gunzipIfNeeded(toArrayBuffer(readFileSync(join(DIR, 'cube-int16.kmdg.gz'))));
  assert.throws(() => decodeKmdg(buf.slice(0, buf.byteLength - 2)), KmdgError);
  const foreign = new Uint8Array(buf.slice(0));
  foreign.set([0x89, 0x50, 0x4e, 0x47]);
  assert.throws(() => decodeKmdg(foreign.buffer), KmdgError);
});

test('passes through an already unwrapped buffer', async () => {
  const gz = toArrayBuffer(readFileSync(join(DIR, 'plane-uint8.kmdg.gz')));
  const once = await gunzipIfNeeded(gz);
  assert.equal(await gunzipIfNeeded(once), once);
});
