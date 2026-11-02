/**
 * Loading the committed assets and computing a frame the way the app computes it — shared by
 * `npm run audit:metrics` and `npm run data:sills`.
 *
 * It exists for the reason the water rule has one owner (`A-02`) and the ice-slice mapping has one
 * (`A-03`): every Node-side tool here claims to measure *what the app does*, and a tool that
 * reloads the grids and reassembles the paleo-DEM in its own thirty lines only claims it. Nothing
 * in this file decides anything — the decisions stay in src/app/core/data, and this is the loader
 * around them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, Geometry } from 'geojson';
import { decodeKmdg, gunzipIfNeeded, kmdgLayer } from '../../src/app/core/data/kmdg.ts';
import type { KmdgGrid } from '../../src/app/core/data/kmdg.ts';
import { buildResampler, paleoElevation, rslAt } from '../../src/app/core/data/paleo.ts';
import type { RslCube } from '../../src/app/core/data/paleo.ts';
import { ASSETS } from '../../src/app/core/data/assets.ts';
import { iceMaskFor, iceSliceFor } from '../../src/app/core/data/ice-field.ts';

export const DATA = join(process.cwd(), 'src', 'assets', 'data');

async function grid(rel: string): Promise<KmdgGrid> {
  const b = readFileSync(join(DATA, rel));
  return decodeKmdg(await gunzipIfNeeded(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer));
}

export interface Frames {
  baltic: KmdgGrid;
  cube: RslCube;
  /** Present-day elevation on the Baltic grid — the layer `H_paleo = H_now − RSL(t)` starts from. */
  hNow: Float32Array;
  /** H_paleo on the Baltic grid at t cal yr BP. A fresh array per call. */
  hpAt(t: number): Float32Array;
  /** The DATED-1 `mc` wall for a frame, by the app's own slice mapping; null where there is none. */
  iceAt(t: number): Uint8Array | null;
  /** Cell index of a position on the Baltic grid, and the centre of a cell. */
  cell(lon: number, lat: number): number;
  lonOf(i: number): number;
  latOf(i: number): number;
}

export async function loadFrames(): Promise<Frames> {
  const baltic = await grid(ASSETS.demBaltic);
  const rslGrid = await grid(ASSETS.rsl);
  const cube: RslCube = {
    geometry: rslGrid,
    times: [...rslGrid.times],
    layers: Array.from({ length: rslGrid.nt }, (_, i) => kmdgLayer(rslGrid, i))
  };
  const hNow = kmdgLayer(baltic, 0);
  const rs = buildResampler(rslGrid, baltic);
  const [bw, bs, be, bn] = baltic.bbox;

  const ice = JSON.parse(readFileSync(join(DATA, ASSETS.ice), 'utf8')) as {
    features: Feature<Geometry, { ka: number; variant: string }>[];
  };
  // Cached per slice: one outline answers for several frames and rasterising is the expensive part.
  const iceCache = new Map<number, Uint8Array>();

  return {
    baltic,
    cube,
    hNow,
    hpAt: (t: number) => paleoElevation(hNow, rslAt(cube, t / 1000), rs),
    iceAt: (t: number) => {
      const ka = iceSliceFor(t);
      if (ka == null) return null;
      let mask = iceCache.get(ka);
      if (!mask) {
        mask = iceMaskFor(ice.features.find(f => f.properties.ka === ka && f.properties.variant === 'mc'), baltic);
        iceCache.set(ka, mask);
      }
      return mask;
    },
    cell: (lon: number, lat: number) =>
      Math.floor(((bn - lat) / (bn - bs)) * baltic.ny) * baltic.nx + Math.floor(((lon - bw) / (be - bw)) * baltic.nx),
    lonOf: (i: number) => bw + ((i % baltic.nx) + 0.5) * ((be - bw) / baltic.nx),
    latOf: (i: number) => bn - (Math.floor(i / baltic.nx) + 0.5) * ((bn - bs) / baltic.ny)
  };
}
