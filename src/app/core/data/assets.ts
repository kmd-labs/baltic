/**
 * Which files live in `src/assets/data/` and which of them the app needs before it can draw
 * anything. Pure data, no DOM and no Angular, because two sides read it: `PaleoDataService.load`
 * fetches `EAGER` and the asset-budget gate (`npm run assets:check`, `0-08` / `V-11`) weighs it.
 *
 * Kept in one place for the reason the water rule is (`A-02`): a budget measured against a
 * hand-maintained copy of the load list stops describing the app the first time the list changes.
 */

/** Prefix under the built app; `src/assets` is copied to `assets` by the Angular builder. */
export const ASSET_BASE = 'assets/data/';

/** The index the app reads first; everything else is located through it (`I-02b`). */
export const MANIFEST = 'manifest.json';

/**
 * Grid ids as `manifest.json` keys them. The app asks for a grid by what it is and the manifest
 * says where it lives, so moving or renaming a grid in the data does not need a code change — and
 * a grid the app needs but the manifest does not publish fails with a sentence instead of an empty
 * scene. The paths below stay the declaration the generator builds the manifest from, and
 * `tests/contract/manifest.test.ts` holds the two to each other.
 */
export const GRID_ID = {
  demEurope: 'dem-europe',
  demBaltic: 'dem-baltic',
  rsl: 'rsl'
} as const;

/**
 * Fetched in parallel by `PaleoDataService.load()` before the first frame. Everything else is
 * either computed in the Web Worker from these (water masks, metrics) or pulled lazily.
 */
export const ASSETS = {
  demEurope: 'grid/dem-europe.bin.gz',
  demBaltic: 'grid/dem-baltic.bin.gz',
  rsl: 'grid/rsl.bin.gz',
  ice: 'ice/dated1.json',
  /** 4 KB, and every frame's phase card needs it to name the outlet — eager rather than lazy. */
  sills: 'sills.json',
  /** Licences and attributions, generated from SOURCES.md; the Sources panel renders them. */
  sources: 'sources.json'
} as const;

/** The same set as a list, for anything that weighs or preloads it rather than naming a file. */
export const EAGER: readonly string[] = Object.values(ASSETS);

/**
 * Plan §5: the whole asset directory within 25 MiB, the first load within 4 MiB. Deploy is GitHub
 * Pages, so these are real limits rather than good intentions — hence the CI gate.
 *
 * Only `src/assets/data/` is weighed. The JS bundle is not in scope here: it is governed by the
 * Angular builder's own budgets, and mixing the two would make a data regression look like a code
 * regression and vice versa.
 */
export const BUDGET = {
  firstLoadBytes: 4 * 1024 * 1024,
  totalBytes: 25 * 1024 * 1024
} as const;
