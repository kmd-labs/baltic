import { Injectable, signal } from '@angular/core';
import type { Geometry } from 'geojson';
import { fetchKmdg, kmdgLayer, KmdgGrid } from './kmdg';
import { buildResampler, paleoElevation, Resampler, rslAt, RslCube } from './paleo';

/** DATED-1 outline for one slice and variant (prototype/ice-dated1.json). */
export interface IceFeature {
  type: 'Feature';
  properties: { ka: number; variant: 'mc' | 'min' | 'max' };
  geometry: Geometry;
}

export interface PaleoFrame {
  ka: number;
  /** H_paleo for every cell of the DEM grid, north first. */
  hPaleo: Float32Array;
  /** DATED-1 outlines on the frame, keyed by variant; empty below 10 ka. */
  ice: Partial<Record<'mc' | 'min' | 'max', IceFeature>>;
}

const BASE = 'assets/data/';

/**
 * Loads the present-day grid, the RSL cube and the ice outlines once, then derives
 * H_paleo = H_now − RSL(t) per frame (C-03 prototype; contract §5).
 */
@Injectable({ providedIn: 'root' })
export class PaleoDataService {
  readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');

  demGrid?: KmdgGrid;
  private hNow?: Float32Array;
  private cube?: RslCube;
  private resampler?: Resampler;
  private ice: IceFeature[] = [];
  private loading?: Promise<void>;

  load(): Promise<void> {
    if (!this.loading) {
      this.state.set('loading');
      this.loading = Promise.all([
        fetchKmdg(BASE + 'grid/dem-europe.bin.gz'),
        fetchKmdg(BASE + 'grid/rsl.bin.gz'),
        fetch(BASE + 'prototype/ice-dated1.json').then(r => {
          if (!r.ok) throw new Error(`ice: HTTP ${r.status}`);
          return r.json();
        })
      ])
        .then(([dem, rsl, ice]) => {
          this.demGrid = dem;
          this.hNow = kmdgLayer(dem, 0);
          this.cube = {
            geometry: rsl,
            times: [...rsl.times],
            layers: Array.from({ length: rsl.nt }, (_, i) => kmdgLayer(rsl, i))
          };
          this.resampler = buildResampler(rsl, dem);
          this.ice = ice.features as IceFeature[];
          this.state.set('ready');
        })
        .catch(err => {
          console.warn('Could not load paleo data:', err);
          this.state.set('error');
        });
    }
    return this.loading;
  }

  /** Frame at `ka` (ka BP). Requires state() === 'ready'. */
  frame(ka: number, reuse?: Float32Array): PaleoFrame {
    if (!this.hNow || !this.cube || !this.resampler) throw new Error('paleo data not loaded');
    const hPaleo = paleoElevation(this.hNow, rslAt(this.cube, ka), this.resampler, reuse);
    const ice: PaleoFrame['ice'] = {};
    for (const f of this.ice) {
      if (f.properties.ka === Math.round(ka) && Math.abs(ka - Math.round(ka)) < 1e-6) ice[f.properties.variant] = f;
    }
    return { ka, hPaleo, ice };
  }
}
