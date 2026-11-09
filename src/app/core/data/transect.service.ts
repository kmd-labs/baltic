import { Injectable, computed, signal } from '@angular/core';

export type TransectId = 'umea-gdansk' | 'danish-straits' | 'gulf-of-finland' | 'polish-coast' | 'custom';

export interface TransectLine {
  id: TransectId;
  points: readonly [number, number][];
}

/**
 * Preset sections (decision 2026-11-09). Each follows a line worth watching through time:
 * - Umeå → Gdańsk: the basin's long axis, the default since the mockup;
 * - Danish straits: Skagerrak → Kattegat → Øresund → Arkona Basin, over the sills that decide
 *   whether the Baltic is a lake or a sea;
 * - Gulf of Finland: along its axis, from the open Baltic to the Neva mouth;
 * - Polish coast: just offshore from the Pomeranian Bay to the Vistula Lagoon, where the
 *   Littorina transgression drowned the coast.
 */
export const PRESETS: readonly TransectLine[] = [
  {
    id: 'umea-gdansk',
    points: [[19.9, 64.3], [20.5, 63.4], [19.6, 61.6], [19.3, 60.15], [18.9, 58.6], [19.9, 57.3], [19.3, 55.1], [18.6, 54.3]]
  },
  {
    id: 'danish-straits',
    points: [[9.6, 57.9], [11.2, 57.4], [12.1, 56.6], [12.65, 56.05], [12.75, 55.55], [13.0, 55.2], [13.6, 54.9]]
  },
  {
    id: 'gulf-of-finland',
    points: [[21.8, 59.3], [23.5, 59.6], [25.0, 59.75], [26.6, 59.95], [28.3, 60.1], [30.2, 59.95]]
  },
  {
    id: 'polish-coast',
    points: [[14.2, 54.05], [15.5, 54.3], [16.6, 54.65], [17.6, 54.85], [18.6, 54.65], [19.4, 54.45]]
  }
];

/**
 * The section shown in the transect panel and drawn on the map: a preset, or the user's own line
 * from two clicks (A → B). Lives only for the session (not in the URL).
 */
@Injectable({ providedIn: 'root' })
export class TransectService {
  private readonly custom = signal<TransectLine | null>(null);
  private readonly selected = signal<TransectId>('umea-gdansk');
  /** Drawing a custom section: waiting for point A, then point B. */
  readonly drawing = signal<'off' | 'a' | 'b'>('off');
  /** Point A while waiting for B. */
  readonly pending = signal<[number, number] | null>(null);

  readonly line = computed<TransectLine>(() => {
    const id = this.selected();
    if (id === 'custom' && this.custom()) return this.custom()!;
    return PRESETS.find(p => p.id === id) ?? PRESETS[0];
  });

  readonly hasCustom = computed(() => this.custom() !== null);

  select(id: TransectId): void {
    if (id === 'custom' && !this.custom()) {
      this.startDrawing();
      return;
    }
    this.cancelDrawing();
    this.selected.set(id);
  }

  startDrawing(): void {
    this.pending.set(null);
    this.drawing.set('a');
  }

  cancelDrawing(): void {
    this.pending.set(null);
    this.drawing.set('off');
  }

  /** A click on the map while drawing. Returns true when it was consumed. */
  pick(lon: number, lat: number): boolean {
    const mode = this.drawing();
    if (mode === 'off') return false;
    if (mode === 'a') {
      this.pending.set([lon, lat]);
      this.drawing.set('b');
      return true;
    }
    const a = this.pending()!;
    if (Math.hypot(lon - a[0], lat - a[1]) < 0.05) return true; // ignore a double click on A
    this.custom.set({ id: 'custom', points: [a, [lon, lat]] });
    this.selected.set('custom');
    this.cancelDrawing();
    return true;
  }

  /** Back to the default section. */
  reset(): void {
    this.cancelDrawing();
    this.selected.set('umea-gdansk');
  }
}
