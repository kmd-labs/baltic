import { Injectable, signal } from '@angular/core';
import type { Feature, Geometry } from 'geojson';
import * as d3Geo from 'd3-geo';
import { fetchKmdg, kmdgLayer, KmdgGrid } from './kmdg';
import { bilinear, buildResampler, GridGeometry, paleoElevation, Resampler, rslAt, RslCube } from './paleo';
import { EVENTS, lakeLevelAt } from './timeline';

export type IceVariant = 'mc' | 'min' | 'max';

export interface IceFeature extends Feature<Geometry, { ka: number; variant: IceVariant }> {}

/** Water code per Baltic-window cell. */
export const enum Water {
  Dry = 0,
  Ocean = 1,
  Lake = 2
}

export interface FrameStats {
  /** Basin area east of the Danish straits, km². */
  areaKm2: number;
  volumeKm3: number;
  maxDepthM: number;
  /** Basin water is connected to the ocean. */
  connected: boolean;
}

export interface PaleoFrame {
  /** cal yr BP */
  t: number;
  /**
   * Level of the isolated basin above the contemporaneous ocean, from the model: the basin is
   * filled up to its lowest outlet towards the ocean (priority-flood, ice as a wall). 0 when the
   * basin is connected to the ocean.
   */
  lakeLevelM: number;
  /** Literature level for the same time (plan §2: BIL +25 m, Ancylus up to +10 m), for the sill-check. */
  literatureLevelM: number;
  /** RSL on the 1° grid at t and at t + 1000 (for the "coast 1000 years earlier" line). */
  rsl: Float32Array;
  rslPrev: Float32Array;
  hpEurope: Float32Array;
  hpBaltic: Float32Array;
  /** Water code per Baltic cell (Water enum). */
  water: Uint8Array;
  /** DATED-1 slice used (ka) or null below 10 ka; `exact` false for event cross-sections. */
  ice: { ka: number; exact: boolean; features: Partial<Record<IceVariant, IceFeature>> } | null;
  iceMask: Uint8Array | null;
  stats: FrameStats;
}

export interface PointInfo {
  lon: number;
  lat: number;
  hNow: number;
  hPaleo: number;
  water: 'ocean' | 'lake' | 'dry';
  ice: boolean;
  /** RSL at the point; positive = sea higher than today. */
  rsl: number;
}

export interface TransectSample {
  km: number;
  lon: number;
  lat: number;
  hNow: number;
  hPaleo: number;
  /** Water surface relative to the contemporaneous ocean, or null when dry. */
  level: number | null;
  ice: boolean;
}

const BASE = 'assets/data/';
const R_EARTH_KM = 6371;
const DEG = Math.PI / 180;

/** Umeå → Gdańsk along the basin axis (mockup transect). */
export const TRANSECT: readonly [number, number][] = [
  [19.9, 64.3], [20.5, 63.4], [19.6, 61.6], [19.3, 60.15], [18.9, 58.6], [19.9, 57.3], [19.3, 55.1], [18.6, 54.3]
];

/** Ocean seeds: Skagerrak cells on the west edge of the Baltic window. */
const OCEAN_SEEDS: readonly [number, number][] = [[9.2, 57.6], [9.2, 58.0], [9.6, 57.9], [10.2, 58.5]];
/** Basin seeds for lake phases: the deeps of the Baltic. */
const BASIN_SEEDS: readonly [number, number][] = [
  [20.0, 57.3], [18.85, 58.6], [15.8, 55.25], [19.3, 55.1], [19.8, 61.6], [22.5, 64.5], [25.5, 59.8]
];

/**
 * DATED-1 slice for the Billingen event sections: the ice margin passes Billingen around
 * 11.7 ka, so "before" keeps the 12 ka outline and "after" takes the 11 ka one. Other
 * sections use the nearest slice. Prototype simplification until ice is interpolated (C-07).
 */
const ICE_SLICE_FOR_EVENT: Record<number, number> = Object.fromEntries(
  EVENTS.filter(e => e.id === 'billingen-before' || e.id === 'billingen-after').map(e => [e.t, e.id === 'billingen-before' ? 12 : 11])
);

/** West of the Danish straits counts as ocean, not basin, in the metrics. */
export function oceanSide(lon: number, lat: number): boolean {
  return lon < 10.3 || (lat > 56.95 && lon < 12.4);
}

/**
 * Loads the present-day grids, the RSL cube and the DATED-1 outlines once, then builds
 * frames: H_paleo = H_now − RSL(t) (C-03), a connectivity-aware water mask in the Baltic
 * window (C-04 prototype: filled from the Skagerrak, or from the deeps up to the literature
 * lake level; ice is a wall) and the basin metrics (C-13 prototype).
 */
@Injectable({ providedIn: 'root' })
export class PaleoDataService {
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly progress = signal(0);

  europe?: KmdgGrid;
  baltic?: KmdgGrid;
  rslGrid?: KmdgGrid;
  hNowEurope?: Float32Array;
  hNowBaltic?: Float32Array;
  private cube?: RslCube;
  private rsEurope?: Resampler;
  private rsBaltic?: Resampler;
  private ice: IceFeature[] = [];
  private iceMasks = new Map<number, Uint8Array>();
  private cellAreaKm2?: Float32Array;
  private cache = new Map<number, PaleoFrame>();
  private shores = new Map<number, Float32Array>();
  private loading?: Promise<void>;

  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.state.set('loading');
    let done = 0;
    const tick = <T>(p: Promise<T>) => p.then(v => (this.progress.set(++done / 4), v));
    this.loading = Promise.all([
      tick(fetchKmdg(BASE + 'grid/dem-europe.bin.gz')),
      tick(fetchKmdg(BASE + 'grid/dem-baltic.bin.gz')),
      tick(fetchKmdg(BASE + 'grid/rsl.bin.gz')),
      tick(
        fetch(BASE + 'prototype/ice-dated1.json').then(r => {
          if (!r.ok) throw new Error(`ice: HTTP ${r.status}`);
          return r.json();
        })
      )
    ])
      .then(([europe, baltic, rsl, ice]) => {
        this.europe = europe;
        this.baltic = baltic;
        this.rslGrid = rsl;
        this.hNowEurope = kmdgLayer(europe, 0);
        this.hNowBaltic = kmdgLayer(baltic, 0);
        this.cube = { geometry: rsl, times: [...rsl.times], layers: Array.from({ length: rsl.nt }, (_, i) => kmdgLayer(rsl, i)) };
        this.rsEurope = buildResampler(rsl, europe);
        this.rsBaltic = buildResampler(rsl, baltic);
        this.ice = ice.features as IceFeature[];
        this.cellAreaKm2 = this.cellAreas(baltic);
        this.state.set('ready');
      })
      .catch(err => {
        console.warn('Could not load paleo data:', err);
        this.state.set('error');
      });
    return this.loading;
  }

  get ready(): boolean {
    return this.state() === 'ready';
  }

  /** Frame at t (cal yr BP). Cached; requires state() === 'ready'. */
  frame(t: number): PaleoFrame {
    const hit = this.cache.get(t);
    if (hit) return hit;
    const cube = this.cube!;
    const ka = t / 1000;
    const rsl = rslAt(cube, ka);
    const rslPrev = rslAt(cube, ka + 1);
    const hpEurope = paleoElevation(this.hNowEurope!, rsl, this.rsEurope!);
    const hpBaltic = paleoElevation(this.hNowBaltic!, rsl, this.rsBaltic!);
    const ice = this.iceFor(t);
    const iceMask = ice ? this.iceMask(ice.ka) : null;
    const { water, level: lakeLevelM } = this.fillWater(hpBaltic, iceMask);
    const frame: PaleoFrame = {
      t,
      lakeLevelM,
      literatureLevelM: lakeLevelAt(t),
      rsl,
      rslPrev,
      hpEurope,
      hpBaltic,
      water,
      ice,
      iceMask,
      stats: this.stats(hpBaltic, water, lakeLevelM)
    };
    if (this.cache.size > 8) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(t, frame);
    return frame;
  }

  /** What is under a point in a frame (tooltip). */
  pointInfo(f: PaleoFrame, lon: number, lat: number): PointInfo | null {
    const b = this.baltic!;
    const e = this.europe!;
    const rsl = bilinear(f.rsl, this.rslGrid!, lon, lat);
    if (inside(b, lon, lat)) {
      const i = cellIndex(b, lon, lat);
      const hNow = bilinear(this.hNowBaltic!, b, lon, lat);
      const code = f.water[i];
      return {
        lon,
        lat,
        hNow,
        hPaleo: hNow - rsl,
        water: code === Water.Ocean ? 'ocean' : code === Water.Lake ? 'lake' : 'dry',
        ice: !!f.iceMask?.[i],
        rsl
      };
    }
    if (inside(e, lon, lat)) {
      const hNow = bilinear(this.hNowEurope!, e, lon, lat);
      const hPaleo = hNow - rsl;
      return { lon, lat, hNow, hPaleo, water: hPaleo < 0 ? 'ocean' : 'dry', ice: this.iceAt(f, lon, lat), rsl };
    }
    return null;
  }

  /** Profile along TRANSECT in the Baltic window. */
  transect(f: PaleoFrame, samples = 260): { total: number; points: TransectSample[] } {
    const seg: number[] = [];
    let total = 0;
    for (let n = 0; n + 1 < TRANSECT.length; n++) {
      const d = distKm(TRANSECT[n], TRANSECT[n + 1]);
      seg.push(d);
      total += d;
    }
    const b = this.baltic!;
    const points: TransectSample[] = [];
    for (let q = 0; q <= samples; q++) {
      let s = (q / samples) * total;
      let n = 0;
      while (n < seg.length - 1 && s > seg[n]) s -= seg[n++];
      const u = Math.min(1, s / seg[n]);
      const [a0, a1] = TRANSECT[n];
      const [b0, b1] = TRANSECT[n + 1];
      const lon = a0 + (b0 - a0) * u;
      const lat = a1 + (b1 - a1) * u;
      const i = cellIndex(b, lon, lat);
      const hNow = bilinear(this.hNowBaltic!, b, lon, lat);
      const hPaleo = hNow - bilinear(f.rsl, this.rslGrid!, lon, lat);
      const code = f.water[i];
      points.push({
        km: (q / samples) * total,
        lon,
        lat,
        hNow,
        hPaleo,
        level: code === Water.Ocean ? 0 : code === Water.Lake ? f.lakeLevelM : null,
        ice: !!f.iceMask?.[i]
      });
    }
    return { total, points };
  }

  /**
   * Shoreline of a frame in the Baltic window as line segments [lon0, lat0, lon1, lat1, …]:
   * marching squares on the smoothed water mask (ocean and basin). Cached per time.
   */
  shoreline(t: number): Float32Array {
    const hit = this.shores.get(t);
    if (hit) return hit;
    const f = this.frame(t);
    const g = this.baltic!;
    const { nx, ny } = g;
    const [west, south, east, north] = g.bbox;
    const v = new Float32Array(nx * ny);
    for (let r = 1; r < ny - 1; r++) {
      for (let c = 1; c < nx - 1; c++) {
        const k = r * nx + c;
        const w = (i: number) => (f.water[i] ? 1 : 0);
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
    const res = new Float32Array(out);
    if (this.shores.size > 8) this.shores.delete(this.shores.keys().next().value!);
    this.shores.set(t, res);
    return res;
  }

  /** RSL at a point for every time in `times` (null while the point is under the ice). */
  rslSeries(lon: number, lat: number, times: readonly number[]): (number | null)[] {
    return times.map(t => {
      const ice = this.iceFor(t);
      if (ice && this.iceAtSlice(ice.ka, lon, lat)) return null;
      return bilinear(rslAt(this.cube!, t / 1000), this.rslGrid!, lon, lat);
    });
  }

  // ─── internals ────────────────────────────────────────────────────────

  private iceFor(t: number): PaleoFrame['ice'] {
    const ka = t / 1000;
    if (ka < 9.5) return null;
    const slice = ICE_SLICE_FOR_EVENT[t] ?? Math.min(20, Math.max(10, Math.round(ka)));
    const features: Partial<Record<IceVariant, IceFeature>> = {};
    for (const f of this.ice) if (f.properties.ka === slice) features[f.properties.variant] = f;
    return { ka: slice, exact: Math.abs(ka - slice) < 1e-6, features };
  }

  /** DATED-1 `mc` outline rasterised onto the Baltic grid. */
  private iceMask(ka: number): Uint8Array {
    const hit = this.iceMasks.get(ka);
    if (hit) return hit;
    const g = this.baltic!;
    const [west, south, east, north] = g.bbox;
    const cv = document.createElement('canvas');
    cv.width = g.nx;
    cv.height = g.ny;
    const cx = cv.getContext('2d', { willReadFrequently: true })!;
    const sx = g.nx / (east - west);
    const sy = g.ny / (north - south);
    const proj = d3Geo.geoTransform({
      point(lon: number, lat: number) {
        this.stream.point((lon - west) * sx, (north - lat) * sy);
      }
    });
    const mc = this.ice.find(f => f.properties.ka === ka && f.properties.variant === 'mc');
    const mask = new Uint8Array(g.nx * g.ny);
    if (mc) {
      cx.beginPath();
      d3Geo.geoPath(proj, cx)(mc);
      cx.fillStyle = '#000';
      cx.fill();
      const px = cx.getImageData(0, 0, g.nx, g.ny).data;
      for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    }
    this.iceMasks.set(ka, mask);
    return mask;
  }

  private iceAtSlice(ka: number, lon: number, lat: number): boolean {
    const b = this.baltic!;
    if (inside(b, lon, lat)) return !!this.iceMask(ka)[cellIndex(b, lon, lat)];
    const mc = this.ice.find(f => f.properties.ka === ka && f.properties.variant === 'mc');
    return !!mc && d3Geo.geoContains(mc, [lon, lat]);
  }

  private iceAt(f: PaleoFrame, lon: number, lat: number): boolean {
    return !!f.ice && this.iceAtSlice(f.ice.ka, lon, lat);
  }

  /**
   * Water in the Baltic window:
   * 1. Ocean — cells reachable from the Skagerrak with H_paleo < 0.
   * 2. Basin — priority-flood from the ocean gives every cell its spill level (the lowest
   *    elevation it must rise to before water drains to the ocean; ice is a wall). Where the
   *    spill level of the Baltic deeps is above the ocean, the basin is a lake at that level —
   *    the outlet sill sets it, not the ocean (plan §0.1, C-06 / C-14 prototype).
   */
  private fillWater(hp: Float32Array, ice: Uint8Array | null): { water: Uint8Array; level: number } {
    const g = this.baltic!;
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

    // 1. Ocean.
    let tail = 0;
    for (const [lon, lat] of OCEAN_SEEDS) {
      const i = cellIndex(g, lon, lat);
      if (i >= 0 && !water[i] && hp[i] < 0 && !ice?.[i]) {
        water[i] = Water.Ocean;
        queue[tail++] = i;
      }
    }
    for (let head = 0; head < tail; head++) {
      neighbours(queue[head], j => {
        if (water[j] || hp[j] >= 0 || ice?.[j]) return;
        water[j] = Water.Ocean;
        queue[tail++] = j;
      });
    }

    // 2. Spill level of every cell, flooding outwards from the ocean.
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

    // 3. The Baltic basin: deeps whose spill level is above their floor, and everything at
    // that level connected to them.
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
          water[i] = Water.Lake;
          queue[tail++] = i;
        }
      }
      for (let head = 0; head < tail; head++) {
        neighbours(queue[head], j => {
          if (water[j] || hp[j] >= level || ice?.[j]) return;
          water[j] = Water.Lake;
          queue[tail++] = j;
        });
      }
    }
    return { water, level };
  }

  private stats(hp: Float32Array, water: Uint8Array, lakeLevel: number): FrameStats {
    const g = this.baltic!;
    const [west, , east, north] = g.bbox;
    const dLon = (east - west) / g.nx;
    const dLat = (north - g.bbox[1]) / g.ny;
    let area = 0;
    let volume = 0;
    let maxDepth = 0;
    let connected = false;
    for (let r = 0; r < g.ny; r++) {
      const lat = north - (r + 0.5) * dLat;
      const a = this.cellAreaKm2![r];
      for (let c = 0; c < g.nx; c++) {
        const i = r * g.nx + c;
        const w = water[i];
        if (!w) continue;
        const lon = west + (c + 0.5) * dLon;
        if (oceanSide(lon, lat)) continue;
        const depth = (w === Water.Lake ? lakeLevel : 0) - hp[i];
        area += a;
        volume += (a * depth) / 1000;
        if (depth > maxDepth) maxDepth = depth;
        if (w === Water.Ocean && lakeLevel === 0) connected = true;
      }
    }
    return { areaKm2: area, volumeKm3: volume, maxDepthM: maxDepth, connected };
  }

  private cellAreas(g: GridGeometry): Float32Array {
    const [west, south, east, north] = g.bbox;
    const dLon = ((east - west) / g.nx) * DEG;
    const dLat = ((north - south) / g.ny) * DEG;
    const out = new Float32Array(g.ny);
    for (let r = 0; r < g.ny; r++) {
      const lat = (north - (r + 0.5) * ((north - south) / g.ny)) * DEG;
      out[r] = R_EARTH_KM * R_EARTH_KM * dLon * dLat * Math.cos(lat);
    }
    return out;
  }
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

export function distKm(a: readonly [number, number], b: readonly [number, number]): number {
  const k = Math.cos(((a[1] + b[1]) / 2) * DEG);
  return Math.hypot((b[0] - a[0]) * k * 111.32, (b[1] - a[1]) * 110.57);
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
