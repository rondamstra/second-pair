/**
 * Amplify Function entry point for the Second Pair review endpoint.
 *
 * The core review behavior lives unchanged in `./lib/reviewHandler.ts` (moved
 * verbatim from the original standalone Lambda backend). This module only
 * re-exports it as the function's `handler` so Amplify/esbuild can bundle it.
 */
export { handler } from './lib/reviewHandler.js'
