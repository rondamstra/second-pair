/** Inclusive bounds for the `content` field, in characters. */
export const MIN_CONTENT_LENGTH = 50
export const MAX_CONTENT_LENGTH = 20_000

/** Raised on invalid client input. The handler maps this to a 400. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

interface ReviewRequestBody {
  content: string
}

/**
 * Parses and validates the raw request body string into a `ReviewRequestBody`.
 *
 * @throws {ValidationError} when the body is missing, not JSON, or `content` is
 * absent, not a string, or outside the allowed length range.
 */
export function parseReviewRequest(rawBody: string | null | undefined): ReviewRequestBody {
  if (rawBody == null || rawBody.trim() === '') {
    throw new ValidationError('Request body is required.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    throw new ValidationError('Request body must be valid JSON.')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError('Request body must be a JSON object.')
  }

  const content = (parsed as Record<string, unknown>).content
  if (typeof content !== 'string') {
    throw new ValidationError('Field "content" is required and must be a string.')
  }

  // Validate against the trimmed length so whitespace padding cannot bypass bounds.
  const length = content.trim().length
  if (length < MIN_CONTENT_LENGTH) {
    throw new ValidationError(
      `Field "content" must be at least ${MIN_CONTENT_LENGTH} characters.`,
    )
  }
  if (length > MAX_CONTENT_LENGTH) {
    throw new ValidationError(
      `Field "content" must be at most ${MAX_CONTENT_LENGTH} characters.`,
    )
  }

  return { content }
}
