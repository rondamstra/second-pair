import { defineFunction } from '@aws-amplify/backend'

/**
 * The Amazon Nova model the review function invokes through Bedrock.
 *
 * Configurable at deploy time: set the `BEDROCK_MODEL_ID` environment variable
 * (Amplify Hosting console → environment variables, or your shell for sandbox).
 * The value is passed through to the function environment and is also used in
 * `backend.ts` to scope the least-privilege Bedrock IAM policy to this model.
 */
// Amazon Nova on Bedrock cannot be invoked by its bare foundation-model id with
// on-demand throughput in most regions (including eu-west-1) — Bedrock requires a
// cross-region inference profile id (e.g. "eu.amazon.nova-lite-v1:0"). We default
// to the EU profile so the deployed sandbox works out of the box; override with
// BEDROCK_MODEL_ID for other regions (e.g. "us.amazon.nova-lite-v1:0").
export const NOVA_MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'eu.amazon.nova-lite-v1:0'

/**
 * Second Pair review function.
 *
 * Runs the existing review handler logic (moved verbatim into ./lib) which
 * validates input, calls Amazon Nova via the Bedrock Converse API, validates the
 * model's structured output, and returns the review. Wired to an API Gateway
 * HTTP API route (POST /review) in `amplify/backend.ts`.
 */
export const review = defineFunction({
  name: 'second-pair-review',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
  environment: {
    // Keep the Nova model ID configurable without a code change.
    BEDROCK_MODEL_ID: NOVA_MODEL_ID,
  },
})
