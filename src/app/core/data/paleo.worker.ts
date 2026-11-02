/// <reference lib="webworker" />
/**
 * Computes frames off the main thread: H_paleo on the Baltic grid, the water mask
 * (ocean fill + priority-flood basin) and the basin metrics.
 * Requests are served newest-first so a jump on the timeline is answered before the
 * background precomputation of the remaining frames.
 */
import { buildResampler, paleoElevation, Resampler, rslAt, RslCube, GridGeometry } from './paleo';
import { basinStats, fillWater } from './water';

export interface WorkerInit {
  type: 'init';
  baltic: GridGeometry;
  hNow: Float32Array;
  cube: RslCube;
  /** DATED-1 `mc` masks on the Baltic grid, by slice (ka). */
  iceMasks: Record<number, Uint8Array>;
}

export interface WorkerRequest {
  type: 'frame';
  t: number;
  iceKa: number | null;
  priority: boolean;
}

export interface WorkerFrame {
  type: 'frame';
  t: number;
  water: Uint8Array;
  level: number;
  /**
   * Cell the basin spills over, −1 when it is connected to the ocean or buried under ice. The
   * fill is the only place that knows it (`water.ts` `WaterFill.outlet`), so dropping it here
   * would leave the phase card able to say how high the lake stood and not which way out it
   * found — the question `C-06b` is about.
   */
  outlet: number;
  stats: ReturnType<typeof basinStats>;
}

let baltic: GridGeometry;
let hNow: Float32Array;
let cube: RslCube;
let resampler: Resampler;
let iceMasks: Record<number, Uint8Array> = {};
let hp: Float32Array;
const queue: WorkerRequest[] = [];
let busy = false;

addEventListener('message', ({ data }: MessageEvent<WorkerInit | WorkerRequest>) => {
  if (data.type === 'init') {
    baltic = data.baltic;
    hNow = data.hNow;
    cube = data.cube;
    iceMasks = data.iceMasks;
    resampler = buildResampler(cube.geometry, baltic);
    hp = new Float32Array(hNow.length);
    return;
  }
  const at = queue.findIndex(q => q.t === data.t);
  if (at >= 0) queue.splice(at, 1);
  if (data.priority) queue.unshift(data);
  else queue.push(data);
  pump();
});

function pump(): void {
  if (busy || !queue.length) return;
  busy = true;
  setTimeout(() => {
    const req = queue.shift()!;
    paleoElevation(hNow, rslAt(cube, req.t / 1000), resampler, hp);
    const ice = req.iceKa != null ? iceMasks[req.iceKa] ?? null : null;
    const { water, level, outlet } = fillWater(baltic, hp, ice);
    const msg: WorkerFrame = {
      type: 'frame',
      t: req.t,
      water,
      level,
      outlet,
      stats: basinStats(baltic, hp, water, level)
    };
    postMessage(msg, [msg.water.buffer]);
    busy = false;
    pump();
  }, 0);
}
