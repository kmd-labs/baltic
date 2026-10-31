/**
 * Water in the Baltic window (C-04 / C-06 / C-13 prototype). Pure functions without DOM or
 * Angular, shared by the Web Worker (paleo.worker.ts) and the main thread.
 */
import type { GridGeometry } from './paleo';

export const WATER_DRY = 0;
export const WATER_OCEAN = 1;
export const WATER_LAKE = 2;

/** Ocean seeds: Skagerrak cells on the west edge of the Baltic window. */
export const OCEAN_SEEDS: readonly [number, number][] = [[9.2, 57.6], [9.2, 58.0], [9.6, 57.9], [10.2, 58.5]];
/** Basin seeds: the deeps of the Baltic. */
export const BASIN_SEEDS: readonly [number, number][] = [
  [20.0, 57.3], [18.85, 58.6], [15.8, 55.25], [19.3, 55.1], [19.8, 61.6], [22.5, 64.5], [25.5, 59.8]
];

export interface FrameStats {
  /** Basin area east of the Danish straits, km². */
  areaKm2: number;
  volumeKm3: number;
  maxDepthM: number;
  /** Basin water is connected to the ocean. */
  connected: boolean;
}

/** West of the Danish straits counts as ocean, not basin, in the metrics. */
export function oceanSide(lon: number, lat: number): boolean {
  return lon < 10.3 || (lat > 56.95 && lon < 12.4);
}

export function inside(g: GridGeometry, lon: number, lat: number): boolean {
  const [west, south, east, north] = g.bbox;
  return lon >= west && lon < east && lat > south && lat <= north;
}

export function cellIndex(g: GridGeometry, lon: number, lat: number): number {
  const [west, south, east, north] = g.bbox;
  const c = Math.floor(((lon - west) / (east - west)) * g.nx);
  const r = Math.floor(((north - lat) / (north - south)) * g.ny);
  if (c < 0 || r < 0 || c >= g.nx || r >= g.ny) return -1;
  return r * g.nx + c;
}

/**
 * 1. Ocean — cells reachable from the Skagerrak with H_paleo < 0.
 * 2. Basin — priority-flood from the ocean gives every cell its spill level; ice is a wall.
 *    Where the spill level of the deeps is above their floor, the basin is a lake at that
 *    level: the outlet sill sets it, not the ocean (plan §0.1).
 */
export function fillWater(g: GridGeometry, hp: Float32Array, ice: Uint8Array | null): { water: Uint8Array; level: number } {
  const { nx, ny } = g;
  const n = nx * ny;
  const water = new Uint8Array(n);
  const queue = new Int32Array(n);
  const neighbours = (i: number, fn: (j: number) => void) => {
    const c = i % nx;
    if (c > 0) fn(i - 1);
    if (c < nx - 1) fn(i + 1);
    if (i >= nx) fn(i - nx);
    if (i < n - nx) fn(i + nx);
  };

  let tail = 0;
  for (const [lon, lat] of OCEAN_SEEDS) {
    const i = cellIndex(g, lon, lat);
    if (i >= 0 && !water[i] && hp[i] < 0 && !ice?.[i]) {
      water[i] = WATER_OCEAN;
      queue[tail++] = i;
    }
  }
  for (let head = 0; head < tail; head++) {
    neighbours(queue[head], j => {
      if (water[j] || hp[j] >= 0 || ice?.[j]) return;
      water[j] = WATER_OCEAN;
      queue[tail++] = j;
    });
  }

  const spill = new Float32Array(n).fill(Infinity);
  const heap = new MinHeap(n);
  for (let k = 0; k < tail; k++) {
    spill[queue[k]] = 0;
    heap.push(queue[k], 0);
  }
  while (heap.size) {
    const i = heap.pop();
    const w = spill[i];
    neighbours(i, j => {
      if (ice?.[j] || spill[j] !== Infinity) return;
      const v = Math.max(w, hp[j]);
      spill[j] = v;
      heap.push(j, v);
    });
  }

  let level = 0;
  for (const [lon, lat] of BASIN_SEEDS) {
    const i = cellIndex(g, lon, lat);
    if (i >= 0 && !water[i] && spill[i] !== Infinity && spill[i] > hp[i]) level = Math.max(level, spill[i]);
  }
  if (level > 0) {
    tail = 0;
    for (const [lon, lat] of BASIN_SEEDS) {
      const i = cellIndex(g, lon, lat);
      if (i >= 0 && !water[i] && hp[i] < level && !ice?.[i]) {
        water[i] = WATER_LAKE;
        queue[tail++] = i;
      }
    }
    for (let head = 0; head < tail; head++) {
      neighbours(queue[head], j => {
        if (water[j] || hp[j] >= level || ice?.[j]) return;
        water[j] = WATER_LAKE;
        queue[tail++] = j;
      });
    }
  }
  return { water, level };
}

export function basinStats(g: GridGeometry, hp: Float32Array, water: Uint8Array, lakeLevel: number): FrameStats {
  const [west, south, east, north] = g.bbox;
  const dLon = (east - west) / g.nx;
  const dLat = (north - south) / g.ny;
  const R = 6371;
  const rad = Math.PI / 180;
  let area = 0;
  let volume = 0;
  let maxDepth = 0;
  let connected = false;
  for (let r = 0; r < g.ny; r++) {
    const lat = north - (r + 0.5) * dLat;
    const a = R * R * dLon * rad * dLat * rad * Math.cos(lat * rad);
    for (let c = 0; c < g.nx; c++) {
      const i = r * g.nx + c;
      const w = water[i];
      if (!w) continue;
      if (oceanSide(west + (c + 0.5) * dLon, lat)) continue;
      const depth = (w === WATER_LAKE ? lakeLevel : 0) - hp[i];
      area += a;
      volume += (a * depth) / 1000;
      if (depth > maxDepth) maxDepth = depth;
      if (w === WATER_OCEAN && lakeLevel === 0) connected = true;
    }
  }
  return { areaKm2: area, volumeKm3: volume, maxDepthM: maxDepth, connected };
}

/** Shoreline as segments [lon0, lat0, lon1, lat1, …]: marching squares on the smoothed water mask. */
export function shoreline(g: GridGeometry, water: Uint8Array): Float32Array {
  const { nx, ny } = g;
  const [west, south, east, north] = g.bbox;
  const v = new Float32Array(nx * ny);
  for (let r = 1; r < ny - 1; r++) {
    for (let c = 1; c < nx - 1; c++) {
      const k = r * nx + c;
      const w = (i: number) => (water[i] ? 1 : 0);
      v[k] = (w(k) * 4 + w(k - 1) + w(k + 1) + w(k - nx) + w(k + nx) + (w(k - nx - 1) + w(k - nx + 1) + w(k + nx - 1) + w(k + nx + 1)) * 0.5) / 10;
    }
  }
  const L = (x: number) => west + ((x + 0.5) / nx) * (east - west);
  const A = (y: number) => north - ((y + 0.5) / ny) * (north - south);
  const out: number[] = [];
  const seg = (p: [number, number], q: [number, number]) => out.push(L(p[0]), A(p[1]), L(q[0]), A(q[1]));
  const iso = 0.5;
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const k = j * nx + i;
      const a = v[k], b = v[k + 1], c = v[k + 1 + nx], d = v[k + nx];
      const idx = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const top = (): [number, number] => [i + (iso - a) / (b - a), j];
      const right = (): [number, number] => [i + 1, j + (iso - b) / (c - b)];
      const bottom = (): [number, number] => [i + (iso - d) / (c - d), j + 1];
      const left = (): [number, number] => [i, j + (iso - a) / (d - a)];
      switch (idx) {
        case 1: case 14: seg(left(), bottom()); break;
        case 2: case 13: seg(bottom(), right()); break;
        case 3: case 12: seg(left(), right()); break;
        case 4: case 11: seg(top(), right()); break;
        case 6: case 9: seg(top(), bottom()); break;
        case 7: case 8: seg(left(), top()); break;
        case 5: seg(left(), bottom()); seg(top(), right()); break;
        case 10: seg(left(), top()); seg(bottom(), right()); break;
      }
    }
  }
  return new Float32Array(out);
}

/** Binary min-heap of cell indices keyed by float priority (priority-flood). */
class MinHeap {
  private readonly keys: Int32Array;
  private readonly prio: Float32Array;
  size = 0;

  constructor(capacity: number) {
    this.keys = new Int32Array(capacity);
    this.prio = new Float32Array(capacity);
  }

  push(k: number, p: number): void {
    let i = this.size++;
    const K = this.keys;
    const P = this.prio;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (P[parent] <= p) break;
      K[i] = K[parent];
      P[i] = P[parent];
      i = parent;
    }
    K[i] = k;
    P[i] = p;
  }

  pop(): number {
    const K = this.keys;
    const P = this.prio;
    const top = K[0];
    const last = --this.size;
    if (last <= 0) return top;
    const lk = K[last];
    const lp = P[last];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= last) break;
      if (c + 1 < last && P[c + 1] < P[c]) c++;
      if (P[c] >= lp) break;
      K[i] = K[c];
      P[i] = P[c];
      i = c;
    }
    K[i] = lk;
    P[i] = lp;
    return top;
  }
}
