/**
 * KMDG/1 reader — binary grids of the Baltic data contract (0-06).
 *
 * Format: contract/README.md. Writer: tools/data/kmdg.py. Both sides are tested
 * against contract/fixtures/grid/. No Angular or DOM dependencies, so it runs in
 * Node tests and in a Web Worker.
 */

export const KMDG_MAGIC = 0x4b4d4447; // 'KMDG'
export const KMDG_VERSION = 1;
export const KMDG_FIXED_HEADER = 68;

export type KmdgDtype = 'uint8' | 'int16' | 'float32';
const DTYPES: Record<number, KmdgDtype> = { 1: 'uint8', 2: 'int16', 3: 'float32' };

export interface KmdgGrid {
  dtype: KmdgDtype;
  nx: number;
  ny: number;
  nt: number;
  /** Outer cell edges in degrees: west, south, east, north. Cell-registered. */
  bbox: readonly [number, number, number, number];
  /** One time per layer, ka BP. */
  times: Float32Array;
  scale: number;
  offset: number;
  nodata: number;
  /** Raw values, layer-major, row 0 = north edge, column 0 = west edge. */
  raw: Uint8Array | Int16Array | Float32Array;
}

export class KmdgError extends Error {}

/** Parses an already gunzipped KMDG buffer. */
export function decodeKmdg(buf: ArrayBuffer): KmdgGrid {
  if (buf.byteLength < KMDG_FIXED_HEADER) throw new KmdgError('KMDG: buffer shorter than the header');
  const v = new DataView(buf);
  if (v.getUint32(0, false) !== KMDG_MAGIC) throw new KmdgError('KMDG: bad magic');
  const version = v.getUint8(4);
  if (version !== KMDG_VERSION) throw new KmdgError(`KMDG: unsupported version ${version}`);
  const dtype = DTYPES[v.getUint8(5)];
  if (!dtype) throw new KmdgError(`KMDG: unknown dtype ${v.getUint8(5)}`);
  const nx = v.getUint16(6, true);
  const ny = v.getUint16(8, true);
  const nt = v.getUint16(10, true);
  const headerBytes = v.getUint16(12, true);
  const bbox = [v.getFloat64(16, true), v.getFloat64(24, true), v.getFloat64(32, true), v.getFloat64(40, true)] as const;
  const scale = v.getFloat64(48, true);
  const offset = v.getFloat64(56, true);
  const nodata = v.getInt32(64, true);

  const times = new Float32Array(nt);
  for (let i = 0; i < nt; i++) times[i] = v.getFloat32(KMDG_FIXED_HEADER + 4 * i, true);

  const n = nx * ny * nt;
  const itemSize = dtype === 'uint8' ? 1 : dtype === 'int16' ? 2 : 4;
  if (buf.byteLength !== headerBytes + n * itemSize) throw new KmdgError('KMDG: size does not match the header');

  // Typed arrays need aligned offsets; headerBytes = 68 + 4·nt is a multiple of 4. Copy if the
  // buffer was handed over as an unaligned slice.
  const raw =
    dtype === 'uint8' ? new Uint8Array(buf, headerBytes, n)
    : dtype === 'int16' ? new Int16Array(buf.slice(headerBytes))
    : new Float32Array(buf.slice(headerBytes));

  return { dtype, nx, ny, nt, bbox, times, scale, offset, nodata, raw };
}

/** Physical value of one cell; NaN for nodata. */
export function kmdgValue(g: KmdgGrid, layer: number, row: number, col: number): number {
  const r = g.raw[(layer * g.ny + row) * g.nx + col];
  if (g.dtype === 'float32') return r;
  return r === g.nodata ? NaN : r * g.scale + g.offset;
}

/** All physical values of one layer as Float32Array (NaN for nodata), row-major from the north. */
export function kmdgLayer(g: KmdgGrid, layer: number): Float32Array {
  const size = g.nx * g.ny;
  const out = new Float32Array(size);
  const base = layer * size;
  for (let i = 0; i < size; i++) {
    const r = g.raw[base + i];
    out[i] = g.dtype === 'float32' ? r : r === g.nodata ? NaN : r * g.scale + g.offset;
  }
  return out;
}

/**
 * Gunzips when the gzip magic is still present. Dev servers and GitHub Pages may send
 * `Content-Encoding: gzip`, in which case the browser has already unwrapped the file.
 */
export async function gunzipIfNeeded(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buf;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

export async function fetchKmdg(url: string, init?: RequestInit): Promise<KmdgGrid> {
  const resp = await fetch(url, init);
  if (!resp.ok) throw new KmdgError(`KMDG: HTTP ${resp.status} for ${url}`);
  return decodeKmdg(await gunzipIfNeeded(await resp.arrayBuffer()));
}
