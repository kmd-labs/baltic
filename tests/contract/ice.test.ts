// The 3D ice body (C-07) is built from a distance transform and the plastic profile, both of which
// are pure maths and testable without a GPU. The rasterisation around them needs a canvas, so it is
// not covered here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edt2d, iceBracket, ICE_PROFILE_K, ICE_KA_MAX, ICE_KA_MIN } from '../../src/app/core/data/ice-field.ts';

const FAR = 1e20;

/** O(n^2) reference: for every cell, the smallest squared distance to a seed. */
function bruteForce(seed: Uint8Array, w: number, h: number): Float64Array {
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = FAR;
      for (let sy = 0; sy < h; sy++) {
        for (let sx = 0; sx < w; sx++) {
          if (!seed[sy * w + sx]) continue;
          const d = (x - sx) * (x - sx) + (y - sy) * (y - sy);
          if (d < best) best = d;
        }
      }
      out[y * w + x] = best;
    }
  }
  return out;
}

test('edt2d matches a brute-force distance transform', () => {
  const w = 29;
  const h = 23;
  // Deterministic pseudo-random seeding, so a failure is reproducible.
  let s = 12345;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const seed = new Uint8Array(w * h);
  for (let i = 0; i < seed.length; i++) seed[i] = rnd() < 0.06 ? 1 : 0;
  seed[0] = 1; // guarantee at least one seed

  const f = new Float64Array(w * h);
  for (let i = 0; i < f.length; i++) f[i] = seed[i] ? 0 : FAR;
  edt2d(f, w, h);

  const want = bruteForce(seed, w, h);
  for (let i = 0; i < f.length; i++) {
    assert.equal(f[i], want[i], `cell ${i % w},${Math.floor(i / w)}: ${f[i]} != ${want[i]}`);
  }
});

test('edt2d handles a single seed and a fully seeded raster', () => {
  const w = 9;
  const h = 7;
  const one = new Float64Array(w * h).fill(FAR);
  one[3 * w + 4] = 0;
  edt2d(one, w, h);
  assert.equal(one[3 * w + 4], 0);
  assert.equal(one[3 * w + 0], 16); // four cells west
  assert.equal(one[0 * w + 4], 9); // three cells north

  const all = new Float64Array(w * h); // every cell a seed
  edt2d(all, w, h);
  for (const v of all) assert.equal(v, 0);
});

test('plastic profile reproduces the C-07 figure', () => {
  // h(d) = sqrt(2 * tau0 * d / (rho_i * g)), tau0 = 100 kPa -> ~3000 m at ~400 km.
  assert.ok(Math.abs(ICE_PROFILE_K - 149.1) < 0.1, `K = ${ICE_PROFILE_K}`);
  const at400km = ICE_PROFILE_K * Math.sqrt(400);
  assert.ok(Math.abs(at400km - 2982) < 5, `h(400 km) = ${at400km}`);
  // Concave: the profile rises fast at the margin and flattens inland.
  const near = ICE_PROFILE_K * Math.sqrt(1);
  const far = ICE_PROFILE_K * Math.sqrt(401) - ICE_PROFILE_K * Math.sqrt(400);
  assert.ok(near > far * 10, 'profile must flatten away from the margin');
});

test('iceBracket lands exactly on the source slices', () => {
  for (let ka = ICE_KA_MIN; ka <= ICE_KA_MAX; ka++) {
    const b = iceBracket(ka * 1000)!;
    assert.equal(b.kaA, ka, `ka=${ka}`);
    assert.equal(b.kaB, ka, `ka=${ka}`);
    assert.equal(b.w, 0);
    assert.equal(b.interpolated, false, `ka=${ka} must not be flagged interpolated`);
    assert.equal(b.fade, 1);
  }
});

test('iceBracket interpolates between slices and is clamped above 20 ka', () => {
  const mid = iceBracket(15500)!;
  assert.equal(mid.kaA, 16);
  assert.equal(mid.kaB, 15);
  assert.ok(Math.abs(mid.w - 0.5) < 1e-9, `w = ${mid.w}`);
  assert.equal(mid.interpolated, true);

  const old = iceBracket(25000)!;
  assert.equal(old.kaA, ICE_KA_MAX);
  assert.equal(old.kaB, ICE_KA_MAX);
  assert.equal(old.w, 0);
});

test('iceBracket is continuous across a slice boundary', () => {
  // A field that is simply the slice age: the blended value must track t with no jump at 15 ka,
  // which is what makes the morph seamless rather than snapping every 1000 years.
  const value = (t: number) => {
    const b = iceBracket(t)!;
    return b.kaA * (1 - b.w) + b.kaB * b.w;
  };
  assert.ok(Math.abs(value(15001) - 15.001) < 1e-6, value(15001).toString());
  assert.ok(Math.abs(value(15000) - 15) < 1e-6, value(15000).toString());
  assert.ok(Math.abs(value(14999) - 14.999) < 1e-6, value(14999).toString());
  // and across the whole range, in 50-year steps
  let prev = value(20000);
  for (let t = 20000 - 50; t >= 10000; t -= 50) {
    const v = value(t);
    assert.ok(prev - v > 0, `must decrease monotonically at t=${t}`);
    assert.ok(Math.abs(prev - v - 0.05) < 1e-6, `step must be 50 yr at t=${t}: ${prev - v}`);
    prev = v;
  }
});

test('iceBracket fades the body out below 10 ka instead of dropping it', () => {
  assert.equal(iceBracket(10000)!.fade, 1);
  const half = iceBracket(9850)!;
  assert.equal(half.kaA, ICE_KA_MIN);
  assert.ok(Math.abs(half.fade - 0.5) < 1e-6, `fade = ${half.fade}`);
  assert.ok(iceBracket(9700)!.fade < 1e-9);
  assert.equal(iceBracket(9600), null);
  assert.equal(iceBracket(0), null);
});
