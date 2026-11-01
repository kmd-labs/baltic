import { Injectable, signal } from '@angular/core';
import type { Feature, Geometry } from 'geojson';
import * as d3Geo from 'd3-geo';
import { fetchKmdg, kmdgLayer, KmdgGrid } from './kmdg';
import { bilinear, maskFractionAt, rslAt, RslCube } from './paleo';
import { FRAMES, lakeLevelAt, nearestFrame } from './timeline';
import { cellIndex, FrameStats, inside, maskHit, WaterKind, waterKindAt, WATER_LAKE, WATER_OCEAN } from './water';
import { ICE_KA_MAX, ICE_KA_MIN, iceMaskFor, iceSignedDistance, iceSliceFor } from './ice-field';
import type { WorkerFrame, WorkerInit, WorkerRequest } from './paleo.worker';

export type { FrameStats, WaterKind } from './water';
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

/**
 * The two frames the scene has in play at a continuous time, and the lake level between them.
 * One answer for the picture and for every readout about it (`A-01`).
 */
export interface SceneWater {
  /** Older bracketing frame, and the only one when t sits on the timeline. */
  a: PaleoFrame;
  /** The younger one, null while the worker has not delivered it. */
  b: PaleoFrame | null;
  /** Blend weight between the two: 0 at `a`, 1 at `b`. */
  w: number;
  /** Lake level interpolated between the frames — the shader's `uLake`. */
  lakeLevelM: number;
}

export interface PointInfo {
  lon: number;
  lat: number;
  hNow: number;
  hPaleo: number;
  water: WaterKind;
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
/** Enough for the frames in play plus the ghost-coast lookups; least recently used evicted. */
const RSL_CACHE_MAX = 48;
/**
 * Continuous time is quantised to this step before an RSL field is computed, so scrubbing reuses
 * cached fields: 25 years is far below one pixel of the timeline and well inside the 1 m agreement
 * the pipeline is checked against (I-01). The renderers upload the field for this step and
 * `rslFor` reads it, so a readout cannot sit a tick away from the picture.
 */
export const RSL_STEP_YR = 25;
const DEG = Math.PI / 180;

/** Umeå → Gdańsk along the basin axis (mockup transect). */
export const TRANSECT: readonly [number, number][] = [
  [19.9, 64.3], [20.5, 63.4], [19.6, 61.6], [19.3, 60.15], [18.9, 58.6], [19.9, 57.3], [19.3, 55.1], [18.6, 54.3]
];

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
  private iceSdfs = new Map<string, Int16Array>();
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
        this.prefetchIceSdfs();
      })
      .catch(err => {
        console.warn('Could not load paleo data:', err);
        this.state.set('error');
      });
    return this.loading;
  }

  /**
   * The frame at t if the worker has delivered it; otherwise requests it with priority.
   *
   * Snapped to the timeline: time is continuous since the ice morphs between slices, but the water
   * mask is only defined on the 1 ka frames, and requesting an arbitrary t would ask the worker for
   * a new flood fill on every animation tick. Callers that need the sub-frame position use
   * `bracket()` instead.
   */
  frame(t: number): PaleoFrame | null {
    const key = nearestFrame(t);
    const f = this.frames.get(key);
    if (f) return f;
    if (!this.prioritised.has(key)) {
      this.prioritised.add(key);
      this.request(key, true);
    }
    return null;
  }

  /**
   * The two timeline frames bracketing t and the blend weight between them: `w` = 0 at `a` (the
   * older frame), 1 at `b`. Both are on the timeline, so neither costs a new worker job.
   *
   * Private: callers want `sceneWater`, which also carries the level between the two.
   */
  private bracket(t: number): { a: PaleoFrame | null; b: PaleoFrame | null; w: number } {
    let older = FRAMES[0];
    let younger = FRAMES[FRAMES.length - 1];
    for (const f of FRAMES) {
      if (f >= t && f < older) older = f;
      if (f <= t && f > younger) younger = f;
    }
    if (t >= FRAMES[0]) older = younger = FRAMES[0];
    if (t <= FRAMES[FRAMES.length - 1]) older = younger = FRAMES[FRAMES.length - 1];
    const w = older === younger ? 0 : (older - t) / (older - younger);
    return { a: this.frame(older), b: this.frame(younger), w };
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
    const te = nearestFrame(t) + 1000;
    const f = this.frames.get(te);
    if (!f) this.request(te, false);
    return f ?? null;
  }

  /**
   * RSL field on the 1° grid at t (cal yr BP). Cheap; cached, least recently used evicted. Time is
   * continuous, so the cache has to be bounded — it would otherwise grow by one 3 321-cell field
   * per animation tick.
   */
  rsl(t: number): Float32Array {
    const hit = this.rslCache.get(t);
    if (hit) {
      // Re-insert, so Map order is least-recently-used first and the eviction below is an LRU
      // rather than the FIFO it would otherwise be. It matters when the playhead turns around or
      // jumps: the ghost-coast field at t + 1000 is read on every tick and would be evicted by
      // the walk that keeps using it.
      this.rslCache.delete(t);
      this.rslCache.set(t, hit);
      return hit;
    }
    const field = rslAt(this.cube!, t / 1000);
    if (this.rslCache.size >= RSL_CACHE_MAX) {
      const lru = this.rslCache.keys().next();
      if (!lru.done) this.rslCache.delete(lru.value);
    }
    this.rslCache.set(t, field);
    return field;
  }

/**
   * Fills the distance-field cache in the background, in the order playback needs it (20 ka
   * forward, outline before uncertainty band). One field costs ~75 ms, and three of them fall due
   * each time playback crosses a 1000-year slice — too much to compute on the tick, so the cache
   * runs ahead of the playhead the same way the worker runs ahead with the water masks.
   *
   * `iceSdf` still computes on demand, so jumping somewhere the prefetch has not reached is
   * correct, just briefly slower.
   */
  private prefetchIceSdfs(): void {
    const jobs: [number, IceVariant][] = [];
    for (let ka = ICE_KA_MAX; ka >= ICE_KA_MIN; ka--) {
      for (const variant of ['mc', 'max', 'min'] as IceVariant[]) jobs.push([ka, variant]);
    }
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
      .requestIdleCallback;
    const next = (): void => {
      const job = jobs.shift();
      if (!job) return;
      this.iceSdf(job[0], job[1]);
      if (idle) idle.call(globalThis, next, { timeout: 500 });
      else setTimeout(next, 16);
    };
    if (idle) idle.call(globalThis, next, { timeout: 500 });
    else setTimeout(next, 16);
  }

  /**
   * Signed distance to the margin of one DATED-1 outline, for the 3D ice body (C-07). Computed on
   * first use and kept: there are only 11 slices × 3 variants, and the pair in view changes once
   * per 1000 model years.
   */
  iceSdf(ka: number, variant: IceVariant): Int16Array {
    const key = `${ka}:${variant}`;
    let f = this.iceSdfs.get(key);
    if (!f) {
      f = iceSignedDistance(this.ice.find(x => x.properties.ka === ka && x.properties.variant === variant));
      this.iceSdfs.set(key, f);
    }
    return f;
  }

  /** Outlines of the slice that walls off this frame's fill; the slice choice is `iceSliceFor`. */
  iceFor(t: number): FrameIce | null {
    const slice = iceSliceFor(t);
    if (slice == null) return null;
    const ka = t / 1000;
    const features: Partial<Record<IceVariant, IceFeature>> = {};
    for (const f of this.ice) if (f.properties.ka === slice) features[f.properties.variant] = f;
    return { ka: slice, exact: Math.abs(ka - slice) < 1e-6, features };
  }

  /**
   * What the scene draws at t. Time is continuous while the water mask is defined only on the 1 ka
   * timeline, so the picture takes the two bracketing frames: their masks are **unioned**, not
   * blended (paleo-shaders.ts `waterMask`), and the lake level is interpolated between them.
   *
   * Everything that has to agree with the picture goes through here — the renderers for the
   * `uLake` uniform, `pointInfo` and `transect` for their readouts (`A-01`).
   */
  sceneWater(t: number): SceneWater | null {
    const { a, b, w } = this.bracket(t);
    const first = a ?? b;
    if (!first) return null;
    const second = b && b !== first ? b : null;
    const la = first.lakeLevelM;
    return { a: first, b: second, w, lakeLevelM: second ? la + (second.lakeLevelM - la) * w : la };
  }

  /**
   * RSL field for a continuous time, quantised to `RSL_STEP_YR` so scrubbing reuses the cache —
   * the same field the renderers upload, so a readout cannot drift from the picture by a tick.
   */
  private rslFor(t: number): Float32Array {
    return this.rsl(Math.round(t / RSL_STEP_YR) * RSL_STEP_YR);
  }

  /** Water class at one point of the Baltic grid, by the rule the shader draws with. */
  private kindAt(s: SceneWater, lon: number, lat: number, hp: number): WaterKind {
    const g = this.baltic!;
    const hit = (code: number) => {
      const fa = maskFractionAt(s.a.water, g, code, lon, lat);
      return maskHit(fa, s.b ? maskFractionAt(s.b.water, g, code, lon, lat) : fa);
    };
    return waterKindAt(hit(WATER_OCEAN), hit(WATER_LAKE), hp, s.lakeLevelM);
  }

  /** What is under a point (tooltip). */
  pointInfo(t: number, lon: number, lat: number): PointInfo | null {
    const s = this.sceneWater(t);
    if (!s) return null;
    const b = this.baltic!;
    const e = this.europe!;
    const rsl = bilinear(this.rslFor(t), this.rslGrid!, lon, lat);
    if (inside(b, lon, lat)) {
      const hNow = bilinear(this.hNowBaltic!, b, lon, lat);
      const hPaleo = hNow - rsl;
      // The ice wall of the flood fill, and this flag with it, stay on the 1 ka timeline — see
      // `iceSliceFor`; the body drawn on the globe is interpolated between slices instead.
      const mask = this.frame(t)?.iceMask;
      return {
        lon,
        lat,
        hNow,
        hPaleo,
        water: this.kindAt(s, lon, lat, hPaleo),
        ice: !!mask?.[cellIndex(b, lon, lat)],
        rsl
      };
    }
    if (inside(e, lon, lat)) {
      const hNow = bilinear(this.hNowEurope!, e, lon, lat);
      const hPaleo = hNow - rsl;
      // Outside the Baltic window there is no fill, and the shader falls back to hp < 0 as well.
      const mc = this.frame(t)?.ice?.features.mc;
      return { lon, lat, hNow, hPaleo, water: hPaleo < 0 ? 'ocean' : 'dry', ice: !!mc && d3Geo.geoContains(mc, [lon, lat]), rsl };
    }
    return null;
  }

  /** Profile along TRANSECT in the Baltic window. Null until the bracketing frames arrive. */
  transect(t: number, samples = 260): { total: number; points: TransectSample[] } | null {
    const s = this.sceneWater(t);
    if (!s) return null;
    const seg: number[] = [];
    let total = 0;
    for (let n = 0; n + 1 < TRANSECT.length; n++) {
      const d = distKm(TRANSECT[n], TRANSECT[n + 1]);
      seg.push(d);
      total += d;
    }
    const b = this.baltic!;
    const rsl = this.rslFor(t);
    const iceMask = this.frame(t)?.iceMask;
    const points: TransectSample[] = [];
    for (let q = 0; q <= samples; q++) {
      let d = (q / samples) * total;
      let n = 0;
      while (n < seg.length - 1 && d > seg[n]) d -= seg[n++];
      const u = Math.min(1, d / seg[n]);
      const [a0, a1] = TRANSECT[n];
      const [b0, b1] = TRANSECT[n + 1];
      const lon = a0 + (b0 - a0) * u;
      const lat = a1 + (b1 - a1) * u;
      const hNow = bilinear(this.hNowBaltic!, b, lon, lat);
      const hPaleo = hNow - bilinear(rsl, this.rslGrid!, lon, lat);
      const kind = this.kindAt(s, lon, lat, hPaleo);
      points.push({
        km: (q / samples) * total,
        lon,
        lat,
        hNow,
        hPaleo,
        level: kind === 'lake' ? s.lakeLevelM : kind === 'ocean' ? 0 : null,
        ice: !!iceMask?.[cellIndex(b, lon, lat)]
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

  /** DATED-1 `mc` outline rasterised onto the Baltic grid — the wall of the flood fill. */
  private iceMask(ka: number): Uint8Array {
    const hit = this.iceMasks.get(ka);
    if (hit) return hit;
    const mc = this.ice.find(f => f.properties.ka === ka && f.properties.variant === 'mc');
    const mask = iceMaskFor(mc, this.baltic!);
    this.iceMasks.set(ka, mask);
    return mask;
  }
}

export function distKm(a: readonly [number, number], b: readonly [number, number]): number {
  const k = Math.cos(((a[1] + b[1]) / 2) * DEG);
  return Math.hypot((b[0] - a[0]) * k * 111.32, (b[1] - a[1]) * 110.57);
}
