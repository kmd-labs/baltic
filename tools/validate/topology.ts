/**
 * Topology and CRS checks on the published geometry (`V-11`).
 *
 * The budget half of `V-11` is `npm run assets:check` and the checksums are in the manifest; what
 * was left is whether the geometry is well formed and whether everything is in one reference
 * system. Both matter for a specific reason rather than on principle:
 *
 * - A self-intersecting ring rasterises differently under a nonzero winding rule than it looks,
 *   and the ice outlines are a **physics input** — the wall of the flood fill (`A-03`). A bow tie
 *   in a margin is a lake that drains the wrong way, not a cosmetic defect.
 * - Everything here is lon/lat degrees, EPSG:4326, and nothing in the KMDG header or in the
 *   GeoJSON says so. RFC 7946 fixes GeoJSON to WGS 84, and the grids carry a degree bbox; what can
 *   still go wrong is a grid written with a projected bbox or swapped axes, which these ranges
 *   would catch.
 *
 * Pure functions, so the registry and the contract tests run the same code.
 */

export interface Ring {
  /** [lon, lat] pairs; the closing point may or may not repeat the first. */
  points: readonly (readonly number[])[];
  /** Where it came from, for the message: feature index and ring index. */
  where: string;
}

/** Every ring of a GeoJSON FeatureCollection of (Multi)Polygons, flattened with its provenance. */
export function ringsOf(fc: {
  features: readonly { properties?: Record<string, unknown> | null; geometry: { type: string; coordinates: unknown } }[];
}): Ring[] {
  const out: Ring[] = [];
  fc.features.forEach((f, fi) => {
    const label = f.properties ? JSON.stringify(f.properties) : `#${fi}`;
    const polys =
      f.geometry.type === 'Polygon'
        ? [f.geometry.coordinates as number[][][]]
        : (f.geometry.coordinates as number[][][][]);
    polys.forEach((poly, pi) =>
      poly.forEach((ring, ri) => out.push({ points: ring, where: `${label} polygon ${pi} ring ${ri}` }))
    );
  });
  return out;
}

const EPS = 1e-12;

/** Do segments p→p2 and q→q2 cross at a point interior to both? Touching at an endpoint does not. */
function crosses(p: readonly number[], p2: readonly number[], q: readonly number[], q2: readonly number[]): boolean {
  const d1x = p2[0] - p[0];
  const d1y = p2[1] - p[1];
  const d2x = q2[0] - q[0];
  const d2y = q2[1] - q[1];
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < EPS) return false; // parallel or collinear — handled as touching, not crossing
  const s = ((q[0] - p[0]) * d2y - (q[1] - p[1]) * d2x) / den;
  const t = ((q[0] - p[0]) * d1y - (q[1] - p[1]) * d1x) / den;
  return s > EPS && s < 1 - EPS && t > EPS && t < 1 - EPS;
}

/**
 * Self-intersections of one ring, as `[i, j]` segment index pairs. Adjacent segments share an
 * endpoint and are skipped; so is the pair that closes the ring.
 *
 * Brute force over segment pairs, but bounded by a sweep on the x extent so the 20 000-point
 * outline set stays well under a second: segments are visited in order and a pair whose x ranges
 * are disjoint is rejected before the arithmetic.
 */
export function selfIntersections(ring: Ring, limit = 8): [number, number][] {
  const p = ring.points;
  const n = p.length - (sameDegenerate(p[0], p[p.length - 1]) ? 1 : 0);
  const hits: [number, number][] = [];
  for (let i = 0; i < n && hits.length < limit; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    const aMinX = Math.min(a[0], b[0]);
    const aMaxX = Math.max(a[0], b[0]);
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // the closing segment touches segment 0
      const c = p[j];
      const d = p[(j + 1) % n];
      if (Math.max(c[0], d[0]) < aMinX || Math.min(c[0], d[0]) > aMaxX) continue;
      if (crosses(a, b, c, d)) {
        hits.push([i, j]);
        if (hits.length >= limit) break;
      }
    }
  }
  return hits;
}

function sameDegenerate(a: readonly number[], b: readonly number[]): boolean {
  return !!a && !!b && Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
}

export interface GeometryReport {
  rings: number;
  points: number;
  /** Rings with a self-intersection, with where and how many. */
  selfIntersecting: { where: string; count: number }[];
  /** Rings that are not closed, or have fewer than four points. */
  malformed: string[];
  /** Coordinates outside lon −180…180 / lat −90…90, which would mean this is not EPSG:4326. */
  outOfRange: string[];
}

export function checkGeometry(fc: Parameters<typeof ringsOf>[0]): GeometryReport {
  const rings = ringsOf(fc);
  const report: GeometryReport = { rings: rings.length, points: 0, selfIntersecting: [], malformed: [], outOfRange: [] };
  for (const ring of rings) {
    report.points += ring.points.length;
    if (ring.points.length < 4) report.malformed.push(`${ring.where}: ${ring.points.length} points`);
    else if (!sameDegenerate(ring.points[0], ring.points[ring.points.length - 1])) {
      report.malformed.push(`${ring.where}: not closed`);
    }
    for (const c of ring.points) {
      if (!(c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90)) {
        report.outOfRange.push(`${ring.where}: ${c[0]}, ${c[1]}`);
        break;
      }
    }
    const hits = selfIntersections(ring);
    if (hits.length) report.selfIntersecting.push({ where: ring.where, count: hits.length });
  }
  return report;
}

/** A KMDG bbox has to be degrees, west of east, south of north, inside the world. */
export function checkBbox(bbox: readonly number[]): string[] {
  const [west, south, east, north] = bbox;
  const bad: string[] = [];
  if (!(west < east)) bad.push(`west ${west} is not west of east ${east}`);
  if (!(south < north)) bad.push(`south ${south} is not south of north ${north}`);
  if (!(west >= -180 && east <= 180)) bad.push(`longitudes ${west}…${east} are outside -180…180`);
  if (!(south >= -90 && north <= 90)) bad.push(`latitudes ${south}…${north} are outside -90…90`);
  return bad;
}
