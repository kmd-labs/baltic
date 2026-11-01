/**
 * Map projection for the block view: a rectangular slab of ground that can be turned in the hand,
 * with bathymetry and mountains at one shared exaggeration.
 *
 * Why a conic and not plate carrée: the window spans 53–67°N, where the east-west ground distance
 * per degree of longitude falls from cos 53° = 0.602 to cos 67° = 0.391. Laying lon/lat straight
 * onto a rectangle would squash the north by 35%. Lambert conformal conic with standard parallels
 * at 56° and 64°N holds the scale error under ~1% across the whole block, and being conformal it
 * keeps coastline shapes true — which is the point of looking at the thing.
 *
 * Spherical forms are used throughout. At this scale the ellipsoidal correction is far below the
 * 2.8 km cell of the source DEM.
 *
 * The block is a true rectangle in *projected* space, i.e. a rectangle on the ground, not in
 * lon/lat. `BLOCK_RECT` encloses the whole DEM window: the alternative, the largest rectangle
 * *inside* it, loses the southern corners to the converging cone — at 53.4°N it reaches only
 * 13.2–28.9°E, which cuts off the Danish straits, Copenhagen and the route of the Littorina
 * transgression. Enclosing instead means the corners fall outside the fine 1/40° window, where
 * `demAt()` falls back to the 0.05° European grid: real data, merely coarser.
 */
import type { GridGeometry } from './paleo';

const D = Math.PI / 180;
const R_EARTH_KM = 6371;

/** The fine 1/40° Baltic DEM, exactly (9–33°E, 53–67°N). */
export const BLOCK_DOMAIN: GridGeometry = {
  bbox: [9, 53, 33, 67],
  nx: 960,
  ny: 560
};

export interface LccParams {
  /** Cone constant. */
  n: number;
  F: number;
  /** Radius at the origin parallel. */
  rho0: number;
  /** Central meridian, degrees. */
  lon0: number;
}

/** Standard parallels at 1/6 and 5/6 of the latitude span keep the scale error minimal. */
export function lccParams(lat1: number, lat2: number, lon0: number, lat0: number): LccParams {
  const p1 = lat1 * D;
  const p2 = lat2 * D;
  const t = (p: number) => Math.tan(Math.PI / 4 + p / 2);
  const n =
    Math.abs(p1 - p2) < 1e-9
      ? Math.sin(p1)
      : Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(t(p2) / t(p1));
  const F = (Math.cos(p1) * Math.pow(t(p1), n)) / n;
  return { n, F, rho0: F / Math.pow(t(lat0 * D), n), lon0 };
}

/** lon/lat (degrees) to projected coordinates in earth radii; y increases north. */
export function lccForward(P: LccParams, lon: number, lat: number): [number, number] {
  const rho = P.F / Math.pow(Math.tan(Math.PI / 4 + (lat * D) / 2), P.n);
  const th = P.n * (lon - P.lon0) * D;
  return [rho * Math.sin(th), P.rho0 - rho * Math.cos(th)];
}

/** Projected coordinates back to lon/lat (degrees). Mirrors the GLSL in block-shaders.ts. */
export function lccInverse(P: LccParams, x: number, y: number): [number, number] {
  const dy = P.rho0 - y;
  const sgn = P.n >= 0 ? 1 : -1;
  const rho = sgn * Math.hypot(x, dy);
  const th = Math.atan2(sgn * x, sgn * dy);
  return [
    P.lon0 + th / P.n / D,
    (2 * Math.atan(Math.pow(P.F / rho, 1 / P.n)) - Math.PI / 2) / D
  ];
}

export const BLOCK_LCC = lccParams(56, 64, 21, 60);

export interface ProjRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Smallest axis-aligned rectangle in projected space enclosing `bbox`. The lon/lat rectangle maps
 * to a fan, so the whole boundary is sampled rather than just the four corners.
 */
export function enclosingRect(P: LccParams, bbox: GridGeometry['bbox'], samples = 256): ProjRect {
  const [w, s, e, n] = bbox;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const take = (lon: number, lat: number) => {
    const [x, y] = lccForward(P, lon, lat);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  };
  for (let i = 0; i <= samples; i++) {
    const lat = s + ((n - s) * i) / samples;
    take(w, lat);
    take(e, lat);
    const lon = w + ((e - w) * i) / samples;
    take(lon, s);
    take(lon, n);
  }
  return { x0, y0, x1, y1 };
}

export const BLOCK_RECT = enclosingRect(BLOCK_LCC, BLOCK_DOMAIN.bbox);

/** Ground size of the block in kilometres. */
export const BLOCK_KM = {
  x: (BLOCK_RECT.x1 - BLOCK_RECT.x0) * R_EARTH_KM,
  y: (BLOCK_RECT.y1 - BLOCK_RECT.y0) * R_EARTH_KM
};

/** The block's long side spans this many world units; everything else follows from it. */
export const BLOCK_SPAN_UNITS = 11;

/** World units per kilometre of ground, so horizontal and vertical share one scale. */
export const UNITS_PER_KM = BLOCK_SPAN_UNITS / Math.max(BLOCK_KM.x, BLOCK_KM.y);

/** World units per projected unit (earth radii). */
export const UNITS_PER_PROJ = R_EARTH_KM * UNITS_PER_KM;

/**
 * World units per metre of elevation at exaggeration 1. Relief here is 2 667 m over 1 336 km —
 * 0.2% of the block's width — so the view needs a large factor to read as relief at all.
 */
export const UNITS_PER_M = UNITS_PER_KM / 1000;
