import { Injectable, signal } from '@angular/core';
import type { Feature, Geometry } from 'geojson';
import * as d3Geo from 'd3-geo';
import { fetchKmdg, kmdgLayer, KmdgGrid } from './kmdg';
import { bilinear, rslAt, RslCube } from './paleo';
import { EVENTS, FRAMES, lakeLevelAt } from './timeline';
import { cellIndex, FrameStats, inside, WATER_LAKE, WATER_OCEAN } from './water';
import type { WorkerFrame, WorkerInit, WorkerRequest } from './paleo.worker';

export type { FrameStats } from './water';
export { oceanSide } from './water';

export type IceVariant = 'mc' | 'min' | 'max';

export interface IceFeature extends Feature<Geometry, { ka: number; variant: IceVariant }> {}

export interface FrameIce {
  ka: number;
  exact: boolean;
  features: Partial<Record<IceVariant, IceFeature>>;
}

/** Everything the app shows for one time. Computed in the Web Worker, cached for all frames. */
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
  /** Water code per Baltic cell (WATER_*). */
  water: Uint8Array;
  ice: FrameIce | null;
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
const DEG = Math.PI / 180;

/** Umeå → Gdańsk along the basin axis (mockup transect). */
export const TRANSECT: readonly [number, number][] = [
  [19.9, 64.3], [20.5, 63.4], [19.6, 61.6], [19.3, 60.15], [18.9, 58.6], [19.9, 57.3], [19.3, 55.1], [18.6, 54.3]
];

/**
 * DATED-1 slice for the Billingen event sections: the ice margin passes Billingen around
 * 11.7 ka, so "before" keeps the 12 ka outline and "after" takes the 11 ka one. Other
 * sections use the nearest slice. Prototype simplification until ice is interpolated (C-07).
 */
const ICE_SLICE_FOR_EVENT: Record<number, number> = Object.fromEntries(
  EVENTS.filter(e => e.id === 'billingen-before' || e.id === 'billingen-after').map(e => [e.t, e.id === 'billingen-before' ? 12 : 11])
);

/**
 * Loads the present-day grids, the RSL cube and the DATED-1 outlines once. RSL fields are
 * interpolated on the main thread (3 321 cells); everything that needs the 1/40° grid — water
 * mask and basin metrics — runs in a Web Worker, which precomputes every frame in the
 * background so stepping through time is instant.
 */
@Injectable({ providedIn: 'root' })
export class PaleoDataService {
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  /** Bumped whenever a frame arrives from the worker. */
  readonly version = signal(0);

  europe?: KmdgGrid;
  baltic?: KmdgGrid;
  rslGrid?: KmdgGrid;
  hNowEurope?: Float32Array;
  hNowBaltic?: Float32Array;
  private cube?: RslCube;
  private ice: IceFeature[] = [];
  private iceMasks = new Map<number, Uint8Array>();
  private frames = new Map<number, PaleoFrame>();
  private requested = new Set<number>();
  private prioritised = new Set<number>();
  private rslCache = new Map<number, Float32Array>();
  private worker?: Worker;
  private loading?: Promise<void>;

  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.state.set('loading');
    this.loading = Promise.all([
      fetchKmdg(BASE + 'grid/dem-europe.bin.gz'),
      fetchKmdg(BASE + 'grid/dem-baltic.bin.gz'),
      fetchKmdg(BASE + 'grid/rsl.bin.gz'),
      fetch(BASE + 'prototype/ice-dated1.json').then(r => {
        if (!r.ok) throw new Error(`ice: HTTP ${r.status}`);
        return r.json();
      })
    ])
      .then(([europe, baltic, rsl, ice]) => {
        this.europe = europe;
        this.baltic = baltic;
        this.rslGrid = rsl;
        this.hNowEurope = kmdgLayer(europe, 0);
        this.hNowBaltic = kmdgLayer(baltic, 0);
        this.cube = { geometry: rsl, times: [...rsl.times], layers: Array.from({ length: rsl.nt }, (_, i) => kmdgLayer(rsl, i)) };
        this.ice = ice.features as IceFeature[];
        this.startWorker();
        this.state.set('ready');
      })
      .catch(err => {
        console.warn('Could not load paleo data:', err);
        this.state.set('error');
      });
    return this.loading;
  }

  /** The frame at t if the worker has delivered it; otherwise requests it with priority. */
  frame(t: number): PaleoFrame | null {
    const f = this.frames.get(t);
    if (f) return f;
    if (!this.prioritised.has(t)) {
      this.prioritised.add(t);
      this.request(t, true);
    }
    return null;
  }

  /** The frame at t if already computed, without requesting it. */
  peek(t: number): PaleoFrame | null {
    return this.frames.get(t) ?? null;
  }

  /**
   * The frame 1000 years earlier (t + 1000), for the "coast 1000 years earlier" line. Also
   * defined for event sections, whose t + 1000 is not on the timeline; requested on demand.
   */
  earlier(t: number): PaleoFrame | null {
    const te = t + 1000;
    const f = this.frames.get(te);
    if (!f) this.request(te, false);
    return f ?? null;
  }

  /** RSL field on the 1° grid at t (cal yr BP). Cheap; cached. */
  rsl(t: number): Float32Array {
    let r = this.rslCache.get(t);
    if (!r) {
      r = rslAt(this.cube!, t / 1000);
      this.rslCache.set(t, r);
    }
    return r;
  }

  iceFor(t: number): FrameIce | null {
    const ka = t / 1000;
    if (ka < 9.5) return null;
    const slice = ICE_SLICE_FOR_EVENT[t] ?? Math.min(20, Math.max(10, Math.round(ka)));
    const features: Partial<Record<IceVariant, IceFeature>> = {};
    for (const f of this.ice) if (f.properties.ka === slice) features[f.properties.variant] = f;
    return { ka: slice, exact: Math.abs(ka - slice) < 1e-6, features };
  }

  /** What is under a point (tooltip). */
  pointInfo(f: PaleoFrame, lon: number, lat: number): PointInfo | null {
    const b = this.baltic!;
    const e = this.europe!;
    const rsl = bilinear(this.rsl(f.t), this.rslGrid!, lon, lat);
    if (inside(b, lon, lat)) {
      const i = cellIndex(b, lon, lat);
      const hNow = bilinear(this.hNowBaltic!, b, lon, lat);
      const code = f.water[i];
      return {
        lon,
        lat,
        hNow,
        hPaleo: hNow - rsl,
        water: code === WATER_OCEAN ? 'ocean' : code === WATER_LAKE ? 'lake' : 'dry',
        ice: !!f.iceMask?.[i],
        rsl
      };
    }
    if (inside(e, lon, lat)) {
      const hNow = bilinear(this.hNowEurope!, e, lon, lat);
      const hPaleo = hNow - rsl;
      const mc = f.ice?.features.mc;
      return { lon, lat, hNow, hPaleo, water: hPaleo < 0 ? 'ocean' : 'dry', ice: !!mc && d3Geo.geoContains(mc, [lon, lat]), rsl };
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
    const rsl = this.rsl(f.t);
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
      const code = f.water[i];
      points.push({
        km: (q / samples) * total,
        lon,
        lat,
        hNow,
        hPaleo: hNow - bilinear(rsl, this.rslGrid!, lon, lat),
        level: code === WATER_OCEAN ? 0 : code === WATER_LAKE ? f.lakeLevelM : null,
        ice: !!f.iceMask?.[i]
      });
    }
    return { total, points };
  }

  // ─── worker ───────────────────────────────────────────────────────────

  private startWorker(): void {
    const masks: Record<number, Uint8Array> = {};
    for (let ka = 10; ka <= 20; ka++) masks[ka] = this.iceMask(ka);
    this.worker = new Worker(new URL('./paleo.worker', import.meta.url), { type: 'module' });
    this.worker.onmessage = ({ data }: MessageEvent<WorkerFrame>) => this.receive(data);
    const init: WorkerInit = {
      type: 'init',
      baltic: { nx: this.baltic!.nx, ny: this.baltic!.ny, bbox: this.baltic!.bbox },
      hNow: this.hNowBaltic!,
      cube: { geometry: { nx: this.rslGrid!.nx, ny: this.rslGrid!.ny, bbox: this.rslGrid!.bbox }, times: this.cube!.times, layers: this.cube!.layers },
      iceMasks: masks
    };
    this.worker.postMessage(init);
    // Precompute every frame in the background.
    for (const t of FRAMES) this.request(t, false);
  }

  private request(t: number, priority: boolean): void {
    if (!this.worker) return;
    if (this.requested.has(t) && !priority) return;
    this.requested.add(t);
    const msg: WorkerRequest = { type: 'frame', t, iceKa: this.iceFor(t)?.ka ?? null, priority };
    this.worker.postMessage(msg);
  }

  private receive(m: WorkerFrame): void {
    if (this.frames.has(m.t)) return;
    const ice = this.iceFor(m.t);
    this.frames.set(m.t, {
      t: m.t,
      lakeLevelM: m.level,
      literatureLevelM: lakeLevelAt(m.t),
      water: m.water,
      ice,
      iceMask: ice ? this.iceMask(ice.ka) : null,
      stats: m.stats
    });
    this.version.update(v => v + 1);
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
}

export function distKm(a: readonly [number, number], b: readonly [number, number]): number {
  const k = Math.cos(((a[1] + b[1]) / 2) * DEG);
  return Math.hypot((b[0] - a[0]) * k * 111.32, (b[1] - a[1]) * 110.57);
}
