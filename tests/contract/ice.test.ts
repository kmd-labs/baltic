// The 3D ice body (C-07) is built from a distance transform and the plastic profile, both of which
// are pure maths and testable without a GPU. Since A-03 the rasterisation around them is too: the
// outlines no longer go through a DOM <canvas>, so the ice wall of the flood fill can be checked
// here against an independent point-in-polygon test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { geoContains } from 'd3-geo';
import type { Feature, Geometry } from 'geojson';
import { decodeKmdg, gunzipIfNeeded, type KmdgGrid } from '../../src/app/core/data/kmdg.ts';
import { bilinear } from '../../src/app/core/data/paleo.ts';
import {
  edt2d,
  fillPath,
  iceBracket,
  iceMaskFor,
  iceSignedDistance,
  iceSliceFor,
  ICE_DOMAIN,
  ICE_PROFILE_K,
  ICE_SDF_SCALE,
  ICE_KA_MAX,
  ICE_KA_MIN,
  iceThickness
} from '../../src/app/core/data/ice-field.ts';

const DATA = join(import.meta.dirname, '..', '..', 'src', 'assets', 'data');

async function grid(rel: string): Promise<KmdgGrid> {
  const b = readFileSync(join(DATA, rel));
  return decodeKmdg(await gunzipIfNeeded(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
}

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

// ── A-03: the outlines rasterise without a DOM ───────────────────────────────────────────────────
// The ice wall of the flood fill used to be rasterised through `document.createElement('canvas')`,
// so a physics input depended on a browser API and the whole ice-dammed phase was unreachable from
// tests. `fillPath` replaces it: a scanline fill, nonzero winding, pixel centres.

test('fillPath sets the cells whose centre is inside the ring', () => {
  // A 4 × 3 rectangle from (1,1) to (5,4) in pixels: centres 1.5…4.5 and 1.5…3.5 are inside.
  const w = 7;
  const h = 6;
  const mask = fillPath([[1, 1, 5, 1, 5, 4, 1, 4]], w, h);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const want = c >= 1 && c <= 4 && r >= 1 && r <= 3 ? 1 : 0;
      assert.equal(mask[r * w + c], want, `cell ${c},${r}`);
    }
  }
});

test('fillPath leaves a hole where the inner ring is wound the other way', () => {
  const w = 10;
  const h = 10;
  const outer = [1, 1, 9, 1, 9, 9, 1, 9];
  const inner = [3, 3, 3, 7, 7, 7, 7, 3]; // reversed, so the winding cancels inside it
  const mask = fillPath([outer, inner], w, h);
  assert.equal(mask[5 * w + 5], 0, 'the hole is empty');
  assert.equal(mask[2 * w + 5], 1, 'the ring between the two is filled');
  assert.equal(mask[5 * w + 2], 1);
  // Without the hole the same outer ring fills the middle, so the hole is doing the work.
  assert.equal(fillPath([outer], w, h)[5 * w + 5], 1);
});

const BALTIC = await grid('grid/dem-baltic.bin.gz');
const ICE = JSON.parse(readFileSync(join(DATA, 'ice', 'dated1.json'), 'utf8')) as {
  features: Feature<Geometry, { ka: number; variant: string }>[];
};
const mcAt = (ka: number) => ICE.features.find(f => f.properties.ka === ka && f.properties.variant === 'mc')!;

/**
 * Independent reference: an even-odd ray cast per point, against the same plate-carrée geometry
 * the mask is built from (`iceMaskFor` projects with `geoTransform`, which streams the vertices
 * through unchanged — no resampling, so straight lines in lon/lat are exactly what both see).
 * A different algorithm and a different fill rule: agreement means the rings are wound
 * consistently *and* the scanline spans land where a per-point test puts them.
 */
function insideRayCast(feature: Feature<Geometry, unknown>, lon: number, lat: number): boolean {
  const polys = feature.geometry.type === 'MultiPolygon'
    ? (feature.geometry.coordinates as number[][][][])
    : [feature.geometry.coordinates as number[][][]];
  let odd = false;
  for (const poly of polys) {
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > lat !== yj > lat && lon < xi + ((lat - yi) / (yj - yi)) * (xj - xi)) odd = !odd;
      }
    }
  }
  return odd;
}

test('rasterised DATED-1 outlines agree with a per-point ray cast', () => {
  const [west, south, east, north] = BALTIC.bbox;
  const dLon = (east - west) / BALTIC.nx;
  const dLat = (north - south) / BALTIC.ny;
  const stride = 16; // ~2 100 points per slice; the ray cast walks every vertex of the outline
  for (const ka of [16, 13]) {
    const mask = iceMaskFor(mcAt(ka), BALTIC);
    let checked = 0;
    for (let r = 0; r < BALTIC.ny; r += stride) {
      const lat = north - (r + 0.5) * dLat;
      for (let c = 0; c < BALTIC.nx; c += stride) {
        const lon = west + (c + 0.5) * dLon;
        assert.equal(!!mask[r * BALTIC.nx + c], insideRayCast(mcAt(ka), lon, lat), `${ka} ka at ${lon.toFixed(3)} ${lat.toFixed(3)}`);
        checked++;
      }
    }
    assert.ok(checked > 2000, `only ${checked} points at ${ka} ka`);
  }
});

test('rasterised DATED-1 outlines agree with d3 geoContains away from the margin', () => {
  // d3 reads the rings as geodesics on a sphere, the raster as straight lines in lon/lat, so the
  // two may differ where the margin crosses a cell — and nowhere else. Cells with a differently
  // classed neighbour are the ones the margin passes through.
  const [west, south, east, north] = BALTIC.bbox;
  const dLon = (east - west) / BALTIC.nx;
  const dLat = (north - south) / BALTIC.ny;
  for (const ka of [20, 13, 10]) {
    const feature = mcAt(ka);
    const mask = iceMaskFor(feature, BALTIC);
    let margin = 0;
    for (let k = 0; k < 400; k++) {
      // Deterministic spread over the window rather than a random sample.
      const r = Math.floor(((k * 37) % BALTIC.ny) / 1);
      const c = Math.floor(((k * 173) % BALTIC.nx) / 1);
      const i = r * BALTIC.nx + c;
      const lon = west + (c + 0.5) * dLon;
      const lat = north - (r + 0.5) * dLat;
      const got = !!mask[i];
      if (got === geoContains(feature, [lon, lat])) continue;
      const neighbours = [i - 1, i + 1, i - BALTIC.nx, i + BALTIC.nx].filter(j => j >= 0 && j < mask.length);
      assert.ok(neighbours.some(j => !!mask[j] !== got), `${ka} ka: disagreement away from the margin at ${lon.toFixed(3)} ${lat.toFixed(3)}`);
      margin++;
    }
    assert.ok(margin < 40, `${ka} ka: ${margin} of 400 sampled cells disagree with geoContains`);
  }
});

test('every DATED-1 slice rasterises, and the sheet is smaller at 10 ka than at 20 ka', () => {
  const cells = new Map<number, number>();
  for (let ka = ICE_KA_MAX; ka >= ICE_KA_MIN; ka--) {
    const n = iceMaskFor(mcAt(ka), BALTIC).reduce((s, v) => s + v, 0);
    assert.ok(n > 0 && n < BALTIC.nx * BALTIC.ny, `${ka} ka rasterises to ${n} of ${BALTIC.nx * BALTIC.ny} cells`);
    cells.set(ka, n);
  }
  assert.ok(
    cells.get(ICE_KA_MAX)! > cells.get(ICE_KA_MIN)! * 2,
    `20 ka ${cells.get(ICE_KA_MAX)} cells vs 10 ka ${cells.get(ICE_KA_MIN)}`
  );
});

// ── A-08: the drawn body and the per-frame mask answer different questions ───────────────────────
// The globe builds the ice from the distance field interpolated between the bracketing slices; the
// mask is the wall of the flood fill and stays on the 1 ka timeline. A readout about the *ice on
// screen* therefore has to ask the field (`PaleoDataService.iceDrawnAt`), which is what the
// tooltip and the transect now do. These two tests say why: the two rasters agree only along the
// margin at an exact slice, and between slices they part company over a large area.
const sdfCache = new Map<number, Int16Array>();
const sdfOf = (ka: number) => {
  let f = sdfCache.get(ka);
  if (!f) {
    f = iceSignedDistance(mcAt(ka));
    sdfCache.set(ka, f);
  }
  return f;
};

/** Area of the window where `sdf > 0` (the drawn body) and the frame's mask disagree, in km². */
function drawnVersusMask(t: number): { km2: number; cells: number; worstMarginKm: number } {
  const b = iceBracket(t)!;
  const mask = iceMaskFor(mcAt(iceSliceFor(t)!), BALTIC);
  const A = sdfOf(b.kaA);
  const B = sdfOf(b.kaB);
  const [west, south, east, north] = BALTIC.bbox;
  const dLon = (east - west) / BALTIC.nx;
  const dLat = (north - south) / BALTIC.ny;
  let km2 = 0;
  let cells = 0;
  let worstMarginKm = 0;
  for (let r = 0; r < BALTIC.ny; r++) {
    const lat = north - (r + 0.5) * dLat;
    const cell = 6371 * 6371 * dLon * (Math.PI / 180) * dLat * (Math.PI / 180) * Math.cos((lat * Math.PI) / 180);
    for (let c = 0; c < BALTIC.nx; c++) {
      const lon = west + (c + 0.5) * dLon;
      const a = bilinear(A, ICE_DOMAIN, lon, lat);
      const d = (b.kaA === b.kaB ? a : a * (1 - b.w) + bilinear(B, ICE_DOMAIN, lon, lat) * b.w) / ICE_SDF_SCALE;
      if (d > 0 === !!mask[r * BALTIC.nx + c]) continue;
      cells++;
      km2 += cell;
      worstMarginKm = Math.max(worstMarginKm, Math.abs(d));
    }
  }
  return { km2, cells, worstMarginKm };
}

test('on an exact slice the distance field and the mask differ only along the margin', () => {
  // Same outline, two rasters: the mask is the grid's own 0.025°, the field is resampled from a
  // ~3.4 km stereographic raster at 0.1°. So they may disagree where the margin runs and nowhere
  // else — which is what makes the mid-interval difference below meaningful rather than noise.
  //
  // This is also the guard on `A-09`. Both of the bugs it fixed show up here: an anticlockwise
  // domain ring scales the globe into the raster instead of the rectangle (the band widens to
  // ~50 km), and an undensified one leaves the southern Baltic outside the raster altogether (the
  // field reads as solid ice over a sixth of the window).
  const exact = drawnVersusMask(20000);
  assert.ok(exact.worstMarginKm < 8, `disagreement ${exact.worstMarginKm.toFixed(1)} km from the margin`);
  const windowKm2 = 24 * 111 * 14 * 111 * Math.cos((60 * Math.PI) / 180);
  assert.ok(exact.km2 < windowKm2 * 0.01, `${Math.round(exact.km2)} km² of disagreement on an exact slice`);
  console.log(`    A-08 baseline (20 ka, exact slice): ${Math.round(exact.km2).toLocaleString('en')} km², within ${exact.worstMarginKm.toFixed(1)} km of the margin`);
});

test('between slices the drawn margin moves away from the frame it was rasterised for', () => {
  const exact = drawnVersusMask(20000);
  const between = drawnVersusMask(10500);
  assert.ok(
    between.km2 > exact.km2 * 3,
    `mid-interval ${Math.round(between.km2)} km² vs baseline ${Math.round(exact.km2)} km²`
  );
  console.log(`    A-08 mid-interval (10.5 ka, 11→10 ka): ${Math.round(between.km2).toLocaleString('en')} km² where a per-frame flag would contradict the body`);
});

test('the thickest point of the 20 ka sheet is the ~3 km C-07 documents', () => {
  // The profile is h = K * sqrt(d), so the thickness is a direct read on the scale of the distance
  // field — the quantity `A-09` had wrong by a factor of 13. A scale error does not look like
  // noise here, it looks like kilometres.
  const sdf = sdfOf(ICE_KA_MAX);
  let far = 0;
  for (const v of sdf) far = Math.max(far, v);
  const km = far / ICE_SDF_SCALE;
  const metres = ICE_PROFILE_K * Math.sqrt(km);
  assert.ok(km > 300 && km < 600, `furthest point from the margin ${km.toFixed(0)} km`);
  assert.ok(metres > 2500 && metres < 3500, `dome ${metres.toFixed(0)} m thick at ${km.toFixed(0)} km from the margin`);
  console.log(`    A-09: 20 ka dome ${metres.toFixed(0)} m at ${km.toFixed(0)} km from the margin`);
});

// C-07b: the thickness the readouts report is the thickness the globe extrudes.
//
// `iceThickness` in ice-field.ts and `iceThickness` in the GLSL of ice-shaders.ts are the same
// formula on two sides of a texture upload. The constant is already shared — the shader takes
// `ICE_PROFILE_K` as a uniform — so what can still drift is the shape, and this holds the two to
// each other the way water.test.ts holds the water rule (`A-02`). The tooltip and the body
// disagreeing about the ice is exactly what `A-08` was.
test('the GLSL plastic profile equals the TypeScript one', () => {
  const glsl = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'app', 'components', 'globe', 'ice-shaders.ts'),
    'utf8'
  );
  const body = /float iceThickness\(float d\)\s*{\s*return ([^;]+);/.exec(glsl);
  assert.ok(body, 'ice-shaders.ts no longer declares iceThickness(float d) — update this test with it');

  // Translate the one expression back to JS. `uProfileK` is the uniform the globe fills with
  // ICE_PROFILE_K (globe.component.ts), so it binds to the same constant here.
  const expr = body[1].replace(/\buProfileK\b/g, 'K').replace(/\bsqrt\b/g, 'Math.sqrt');
  const fromGlsl = new Function('d', 'K', `return ${expr};`) as (d: number, K: number) => number;

  for (const d of [-10, -0.001, 0, 0.001, 1, 4, 25, 100, 225, 400, 900]) {
    assert.ok(
      Math.abs(fromGlsl(d, ICE_PROFILE_K) - iceThickness(d)) < 1e-9,
      `d = ${d} km: GLSL ${fromGlsl(d, ICE_PROFILE_K)} m, TS ${iceThickness(d)} m`
    );
  }
});

test('the plastic profile has the documented magnitudes', () => {
  // The numbers the comment on ICE_PROFILE_K and the C-07 scope both quote.
  assert.equal(iceThickness(0), 0, 'no ice outside the margin');
  assert.equal(iceThickness(-5), 0, 'and none at a negative distance');
  assert.ok(Math.abs(iceThickness(1) - 149) < 1, `${iceThickness(1).toFixed(0)} m at 1 km from the margin`);
  assert.ok(Math.abs(iceThickness(400) - 2982) < 2, `${iceThickness(400).toFixed(0)} m at 400 km`);
  // Monotone and concave: thicker inland, and the gain per km falls off.
  assert.ok(iceThickness(100) > iceThickness(50));
  assert.ok(iceThickness(100) - iceThickness(50) < iceThickness(50) - iceThickness(1));
});
