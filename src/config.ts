import { Amplify } from 'aws-amplify'

/**
 * The review API endpoint, resolved once from the generated Amplify outputs at
 * configure time. Cached in module scope so `getReviewApiUrl()` does not depend
 * on `Amplify.getConfig()` round-tripping the top-level `custom` block (it does
 * not reliably do so on the web SDK — `custom` is not part of ResourcesConfig).
 */
let cachedReviewApiUrl: string | null = null

interface AmplifyOutputs {
  custom?: { reviewApiUrl?: unknown }
}

function readCustomReviewApiUrl(outputs: AmplifyOutputs): string | null {
  const url = outputs.custom?.reviewApiUrl
  return typeof url === 'string' && url.trim() ? url.trim() : null
}

/**
 * Resolves the deployed review API endpoint.
 *
 * Resolution order:
 * 1. `VITE_REVIEW_API_URL` build-time env var (useful for local dev against a
 *    sandbox without the generated outputs).
 * 2. `custom.reviewApiUrl` captured from `amplify_outputs.json` during
 *    `configureAmplify()`.
 *
 * Returns `null` when no endpoint is configured. Callers must treat that as a
 * visible configuration error — there is no mock/static fallback.
 */
export function getReviewApiUrl(): string | null {
  const fromEnv = import.meta.env.VITE_REVIEW_API_URL
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim()
  }
  return cachedReviewApiUrl
}

/**
 * Configures Amplify from the generated `amplify_outputs.json` and captures the
 * custom review API endpoint.
 *
 * The file is gitignored and only exists after `npx ampx sandbox` (local) or a
 * pipeline deploy (CI). The import is dynamic and guarded so the frontend still
 * builds when the file is absent; if it is absent at runtime, a review attempt
 * fails visibly rather than returning fake data.
 */
export async function configureAmplify(): Promise<void> {
  try {
    // amplify_outputs.json is generated at deploy time and gitignored, so it may
    // be absent at type-check/build time. Vite resolves it (or a stub) at build;
    // ts-ignore keeps tsc from failing on the possibly-missing module.
    // @ts-ignore - generated file, may not exist during type-check
    const outputs = (await import('../amplify_outputs.json')).default as AmplifyOutputs
    Amplify.configure(outputs)
    // Read the endpoint straight from the outputs file. Do NOT rely on
    // Amplify.getConfig() to return `custom` — it normalizes to its known config
    // schema and drops arbitrary top-level keys.
    cachedReviewApiUrl = readCustomReviewApiUrl(outputs)
  } catch {
    // No outputs yet (fresh clone, no deploy). getReviewApiUrl() stays null and a
    // review attempt fails visibly — no mock/static fallback.
    cachedReviewApiUrl = null
  }
}
