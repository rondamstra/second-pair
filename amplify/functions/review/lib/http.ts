import type { APIGatewayProxyResultV2 } from 'aws-lambda'

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  // CORS: the SPA calls this endpoint from the browser. Tighten the origin in
  // production via the ALLOWED_ORIGIN environment variable.
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN?.trim() || '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  // Defense-in-depth headers.
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
}

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: BASE_HEADERS,
    body: JSON.stringify(body),
  }
}

/** 200 with the validated review payload. */
export function ok(body: unknown): APIGatewayProxyResultV2 {
  return response(200, body)
}

/**
 * Error envelope. `message` is a safe, client-facing string only — it must never
 * contain internal error details, stack traces, or AWS metadata.
 */
export function error(
  statusCode: number,
  code: string,
  message: string,
): APIGatewayProxyResultV2 {
  return response(statusCode, { error: { code, message } })
}

export const badRequest = (message: string) => error(400, 'bad_request', message)

export const methodNotAllowed = () =>
  error(405, 'method_not_allowed', 'Method not allowed.')

/** Generic upstream failure. Deliberately opaque. */
export const badGateway = () =>
  error(502, 'bad_gateway', 'The review service is temporarily unavailable.')

/** Generic internal failure. Deliberately opaque. */
export const internalError = () =>
  error(500, 'internal_error', 'An unexpected error occurred.')

/** Preflight response for browser CORS. */
export const noContent = (): APIGatewayProxyResultV2 => ({
  statusCode: 204,
  headers: BASE_HEADERS,
  body: '',
})
