import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { generateReview, UpstreamError } from './bedrock.js'
import {
  badGateway,
  badRequest,
  internalError,
  methodNotAllowed,
  noContent,
  ok,
} from './http.js'
import { parseReviewRequest, ValidationError } from './validation.js'

/** Reads the request body, decoding base64 if API Gateway encoded it. */
function readBody(event: APIGatewayProxyEventV2): string | undefined {
  if (event.body == null) return undefined
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf-8')
  }
  return event.body
}

function method(event: APIGatewayProxyEventV2): string {
  return event.requestContext?.http?.method ?? ''
}

/**
 * Lambda handler for `POST /review`.
 *
 * Flow: validate input -> invoke Nova via Bedrock -> validate model output -> 200.
 * Errors map to 400 (bad input), 502 (bad upstream/model output), or 500 (anything
 * unexpected). Internal error details and AWS metadata are never returned to the
 * client, and submitted content is never logged or persisted.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const httpMethod = method(event)

  // CORS preflight.
  if (httpMethod === 'OPTIONS') {
    return noContent()
  }

  if (httpMethod !== 'POST') {
    return methodNotAllowed()
  }

  console.info('review request received')

  // 1. Parse and validate input. Bad input -> 400.
  let content: string
  try {
    ;({ content } = parseReviewRequest(readBody(event)))
    // Safe diagnostic: length only, never the submitted content itself.
    console.info('input validated', { contentLength: content.length })
  } catch (err) {
    if (err instanceof ValidationError) {
      return badRequest(err.message)
    }
    // Unexpected parsing failure.
    console.error('unexpected validation failure', { name: (err as Error)?.name })
    return internalError()
  }

  // 2. Invoke the model and validate its output. Upstream/model issues -> 502.
  try {
    const review = await generateReview(content)
    return ok(review)
  } catch (err) {
    if (err instanceof UpstreamError) {
      // Log a non-sensitive diagnostic. We deliberately do not log the cause's
      // full details or any request content.
      console.error('upstream review failure', { reason: err.message })
      return badGateway()
    }
    // Anything else is an unexpected internal fault.
    console.error('unhandled review error', { name: (err as Error)?.name })
    return internalError()
  }
}
