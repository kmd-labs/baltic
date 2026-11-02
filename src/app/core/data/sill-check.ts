/**
 * Sill-check (`V-02`): does the elevation balance at the outlets agree with the state the model
 * draws? The rule the plan states (§0.1, §0.2) is short — **a dammed lake needs an outlet above the
 * contemporaneous ocean, a marine connection one below** — and it is worth checking precisely
 * because it fails loudly for the two errors that are hardest to see otherwise: eustasy counted
 * twice, and a confused datum. Both would put the whole curve metres out without changing the
 * shape of anything on screen.
 *
 * Two kinds of finding come out of it, and they are not the same thing:
 *
 * - **Invariants** (`balance`), which are statements about the model alone and must hold. A lake
 *   whose outlet is below sea level is not a lake; a basin connected to the ocean cannot stand
 *   above it. These block.
 * - **Catalogue diagnostics** (`nearest`, `suspect`), which compare the model with the hand-made
 *   sill catalogue in geo.ts. These do not block: the catalogue is a prototype awaiting `C-05`,
 *   and where the two disagree it is usually the catalogue that is wrong — which is exactly the
 *   evidence `C-05` needs.
 *
 * Pure, without DOM or Angular, so the contract tests and `npm run audit:metrics` run the same
 * code as the app.
 */
import type { GridGeometry } from './paleo';
import type { WaterFill } from './water';
import { BASIN_SEEDS, cellIndex, WATER_OCEAN } from './water';
import { nearestSill } from './sills';
import type { SillPoint } from './sills';

export type { SillPoint };

export interface SillState extends SillPoint {
  /** H_paleo at the catalogue point, metres relative to the contemporaneous ocean. */
  hp: number;
  /** The point lies under the ice sheet, so it is not a route whatever its elevation. */
  underIce: boolean;
}

/**
 * What the basin is at a frame. `buried` is a real third state, not an error: at 20 and 19 ka the
 * sheet covers the deeps themselves, so there is no basin water to balance anything against.
 */
export type BasinState = 'lake' | 'connected' | 'buried';

export interface SillCheck {
  t: number;
  state: BasinState;
  /** Lake level above the contemporaneous ocean; 0 when the basin is connected. */
  level: number;
  connected: boolean;
  /** The outlet the fill actually spills over, or null when the basin is connected. */
  outlet: { lon: number; lat: number; hp: number } | null;
  /** Distance from that outlet to the nearest catalogue sill, and which one. */
  nearest: { id: string; km: number } | null;
  sills: SillState[];
  /**
   * Catalogue points that are submerged, ice-free and below the lake level — so by the catalogue
   * the lake should have drained through them, and it did not. Not a model failure: it means the
   * point is not on the basin's drainage path (a local pit, or simply misplaced).
   */
  suspect: string[];
  /** Invariant failures. Empty is the only acceptable value; see `assertBalance`. */
  balance: string[];
}

/**
 * One frame against the catalogue. `fill` is the output of `fillWater` for the same `hp` and ice
 * mask — passed in rather than recomputed, so the check describes the frame the app drew.
 */
export function sillCheck(
  g: GridGeometry,
  t: number,
  hp: Float32Array,
  ice: Uint8Array | null,
  fill: WaterFill,
  sills: readonly SillPoint[]
): SillCheck {
  const [west, south, east, north] = g.bbox;
  const dLon = (east - west) / g.nx;
  const dLat = (north - south) / g.ny;
  const lonOf = (i: number) => west + ((i % g.nx) + 0.5) * dLon;
  const latOf = (i: number) => north - (Math.floor(i / g.nx) + 0.5) * dLat;

  const seeds = BASIN_SEEDS.map(([lon, lat]) => cellIndex(g, lon, lat)).filter(i => i >= 0);
  const connected = seeds.some(i => fill.water[i] === WATER_OCEAN);
  const state: BasinState = fill.level > 0 ? 'lake' : connected ? 'connected' : 'buried';

  const states: SillState[] = sills.map(s => {
    const i = cellIndex(g, s.lon, s.lat);
    return { ...s, hp: i >= 0 ? hp[i] : NaN, underIce: i >= 0 && !!ice?.[i] };
  });

  const outlet =
    fill.outlet >= 0 ? { lon: lonOf(fill.outlet), lat: latOf(fill.outlet), hp: hp[fill.outlet] } : null;
  const near = outlet ? nearestSill(states, outlet.lon, outlet.lat) : null;
  const nearest = near ? { id: near.sill.id, km: near.km } : null;

  const balance: string[] = [];
  if (state === 'lake') {
    // A lake stands above the ocean, so it cannot also be the ocean, and the outlet holding it up
    // has to be above sea level and at the lake's own surface.
    if (connected) balance.push(`poziom +${fill.level.toFixed(1)} m przy połączeniu z oceanem`);
    if (!outlet) balance.push('jezioro bez progu sterującego');
    else {
      if (outlet.hp < 0) balance.push(`próg sterujący pod poziomem oceanu (${outlet.hp.toFixed(1)} m)`);
      if (Math.abs(outlet.hp - fill.level) > 0.5) {
        balance.push(`próg ${outlet.hp.toFixed(1)} m nie odpowiada poziomowi ${fill.level.toFixed(1)} m`);
      }
    }
  } else if (state === 'connected') {
    if (outlet) balance.push('połączenie z oceanem z progiem sterującym');
  } else {
    // Buried: every deep has to be under the ice or above the contemporaneous sea. A dry seed
    // below sea level with no ice over it would mean water the fill failed to reach.
    for (const i of seeds) {
      if (!ice?.[i] && hp[i] < 0) {
        balance.push(`głębia ${lonOf(i).toFixed(2)}E ${latOf(i).toFixed(2)}N na ${hp[i].toFixed(0)} m bez wody i bez lodu`);
      }
    }
  }

  const suspect =
    fill.level > 0 ? states.filter(s => !s.underIce && s.hp < fill.level).map(s => s.id) : [];

  return { t, state, level: fill.level, connected, outlet, nearest, sills: states, suspect, balance };
}

/** Throws with every invariant failure of a frame; the blocking half of `V-02`. */
export function assertBalance(check: SillCheck): void {
  if (check.balance.length) {
    throw new Error(`${check.t} cal BP — bilans rzędnych: ${check.balance.join('; ')}`);
  }
}
