import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
} from '@aws-sdk/client-bedrock-runtime'
import { buildUserMessage, SECOND_PAIR_SYSTEM_PROMPT } from './prompt.js'
import { parseReviewResult, SchemaValidationError } from './schema.js'
import type { ReviewResult } from './types.js'

/**
 * Raised when the upstream model call fails or returns output we cannot turn into
 * a valid review. The handler maps this to a 502 (bad upstream response).
 */
export class UpstreamError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'UpstreamError'
  }
}

// Must be an inference profile id for Nova on-demand invocation (see resource.ts).
const DEFAULT_MODEL_ID = 'eu.amazon.nova-lite-v1:0'
const DEFAULT_MAX_TOKENS = 2000
const DEFAULT_TEMPERATURE = 0.2

function modelId(): string {
  return process.env.BEDROCK_MODEL_ID?.trim() || DEFAULT_MODEL_ID
}

// The client is created once per container and reused across invocations.
// Region is taken from the Lambda's AWS_REGION environment automatically.
let cachedClient: BedrockRuntimeClient | undefined

function client(): BedrockRuntimeClient {
  if (!cachedClient) {
    cachedClient = new BedrockRuntimeClient({})
  }
  return cachedClient
}

/** Concatenates all text blocks in the assistant response. */
function extractText(content: ContentBlock[] | undefined): string {
  if (!content) return ''
  return content
    .map((block) => ('text' in block && typeof block.text === 'string' ? block.text : ''))
    .join('')
    .trim()
}

/**
 * Extracts a single JSON object from model text. Tolerates accidental code fences
 * or leading/trailing prose by slicing from the first `{` to the last `}`.
 */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new UpstreamError('model response did not contain a JSON object')
  }
  const candidate = text.slice(start, end + 1)
  try {
    return JSON.parse(candidate)
  } catch (err) {
    throw new UpstreamError('model response was not valid JSON', err)
  }
}

/**
 * Sends the deployment content to Amazon Nova via the Bedrock Converse API and
 * returns a validated `ReviewResult`.
 *
 * The submitted content is only ever held in memory for the duration of the call;
 * it is never logged or persisted.
 *
 * @throws {UpstreamError} on any model/transport failure or invalid output.
 */
export async function generateReview(content: string): Promise<ReviewResult> {
  const activeModelId = modelId()

  const messages: Message[] = [
    {
      role: 'user',
      content: [{ text: buildUserMessage(content) }],
    },
  ]

  const command = new ConverseCommand({
    modelId: activeModelId,
    system: [{ text: SECOND_PAIR_SYSTEM_PROMPT }],
    messages,
    inferenceConfig: {
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
    },
  })

  // Safe operational diagnostics only: model id and timings. Never the submitted
  // content, secrets, or the model's output text.
  console.info('bedrock invocation started', { modelId: activeModelId })
  const startedAt = Date.now()

  let response
  try {
    response = await client().send(command)
  } catch (err) {
    console.error('bedrock invocation failed', {
      modelId: activeModelId,
      name: (err as Error)?.name,
    })
    // Network/permission/throttling/model errors from Bedrock.
    throw new UpstreamError('bedrock invocation failed', err)
  }

  console.info('bedrock invocation completed', {
    modelId: activeModelId,
    latencyMs: Date.now() - startedAt,
    stopReason: response.stopReason,
    outputTokens: response.usage?.outputTokens,
  })

  if (response.stopReason === 'content_filtered') {
    throw new UpstreamError('model response was filtered by content policy')
  }

  const text = extractText(response.output?.message?.content)
  if (!text) {
    throw new UpstreamError('model returned an empty response')
  }

  const raw = extractJsonObject(text)

  try {
    const result = parseReviewResult(raw)
    // Log only the validated verdict — a single safe enum, not user content.
    console.info('model output validation succeeded', { verdict: result.verdict })
    return result
  } catch (err) {
    if (err instanceof SchemaValidationError) {
      console.error('model output validation failed', { reason: err.message })
      throw new UpstreamError(`model output failed validation: ${err.message}`, err)
    }
    console.error('model output validation errored', { name: (err as Error)?.name })
    throw new UpstreamError('unexpected error validating model output', err)
  }
}
