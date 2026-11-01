/**
 * Resolution hook for the Node-side runners (contract tests, `npm run audit:metrics`).
 *
 * The app imports siblings without a file extension, the way the Angular bundler resolves them,
 * while Node's ESM resolver wants one. Without this hook a module loaded in Node may only ever
 * import *types* from its siblings — which is why the data layer kept duplicating rules instead of
 * sharing them (the water rule of `A-02`, the ice-slice mapping of `A-03`). Mapping './x' to
 * './x.ts' costs fifteen lines and removes the reason to duplicate.
 */
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.(?:[cm]?[jt]s|json)$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        // Not a TypeScript sibling after all — let the default resolution report it.
      }
    }
    return next(specifier, context);
  }
});
