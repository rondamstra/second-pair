import { getReviewApiUrl } from './config'
import type {
  ChecklistItem,
  Issue,
  ReviewResult,
  Score,
  ScoreKey,
  Severity,
  Verdict,
} from './types'

/**
 * Error carrying a safe, user-facing message. Thrown for every failure path
 * (validation, network, upstream/Bedrock, malformed response) so the UI's error
 * state renders a clean message and never leaks internals.
 */
export class ReviewError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReviewError'
  }
}

const VERDICTS: readonly Verdict[] = ['SHIP', 'REVIEW', 'STOP']
const SEVERITIES: readonly Severity[] = ['high', 'medium', 'low']
const SCORE_KEYS: readonly ScoreKey[] = [
  'security',
  'reliability',
  'cost',
  'operability',
]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
}

function parseScore(v: unknown): Score | null {
  if (!isRecord(v)) return null
  if (!oneOf<ScoreKey>(v.key, SCORE_KEYS)) return null
  if (!isNonEmptyString(v.label)) return null
  if (typeof v.value !== 'number' || !Number.isFinite(v.value)) return null
  // Clamp defensively so a stray out-of-range value can't distort the bar.
  const value = Math.max(0, Math.min(100, Math.round(v.value)))
  return { key: v.key, label: v.label, value }
}

function parseIssue(v: unknown): Issue | null {
  if (!isRecord(v)) return null
  if (!isNonEmptyString(v.id)) return null
  if (!oneOf<Severity>(v.severity, SEVERITIES)) return null
  if (!isNonEmptyString(v.title)) return null
  if (typeof v.detail !== 'string') return null
  return { id: v.id, severity: v.severity, title: v.title, detail: v.detail }
}

function parseChecklistItem(v: unknown): ChecklistItem | null {
  if (!isRecord(v)) return null
  if (!isNonEmptyString(v.id)) return null
  if (!isNonEmptyString(v.label)) return null
  if (typeof v.done !== 'boolean') return null
  return { id: v.id, label: v.label, done: v.done }
}

/**
 * Validates an untrusted API payload against the `ReviewResult` contract.
 * Returns a fully-typed result, or `null` if anything is missing or malformed.
 * This is client-side defense-in-depth on top of the backend's own validation:
 * the render layer can then assume well-formed data and never crash on bad input.
 */
export function parseReviewResult(raw: unknown): ReviewResult | null {
  if (!isRecord(raw)) return null

  if (!oneOf<Verdict>(raw.verdict, VERDICTS)) return null
  if (typeof raw.summary !== 'string') return null

  if (!Array.isArray(raw.scores)) return null
  const scores: Score[] = []
  for (const s of raw.scores) {
    const parsed = parseScore(s)
    if (!parsed) return null
    scores.push(parsed)
  }
  // Require exactly the four canonical dimensions, each once.
  const keys = new Set(scores.map((s) => s.key))
  if (keys.size !== SCORE_KEYS.length || !SCORE_KEYS.every((k) => keys.has(k))) {
    return null
  }

  if (!Array.isArray(raw.issues)) return null
  const issues: Issue[] = []
  for (const i of raw.issues) {
    const parsed = parseIssue(i)
    if (!parsed) return null
    issues.push(parsed)
  }

  if (!Array.isArray(raw.checklist)) return null
  const checklist: ChecklistItem[] = []
  for (const c of raw.checklist) {
    const parsed = parseChecklistItem(c)
    if (!parsed) return null
    checklist.push(parsed)
  }

  if (!Array.isArray(raw.strengths)) return null
  const strengths: string[] = []
  for (const s of raw.strengths) {
    if (typeof s !== 'string') return null
    strengths.push(s)
  }

  return { verdict: raw.verdict, summary: raw.summary, scores, issues, checklist, strengths }
}

/**
 * Calls the deployed review API (POST /review) with the deployment content as
 * JSON. Throws `ReviewError` with a user-facing message on any failure:
 * network error, non-2xx (validation/Bedrock), or a malformed success body.
 */
export async function requestReview(
  apiUrl: string,
  content: string,
): Promise<ReviewResult> {
  let response: Response
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  } catch {
    throw new ReviewError(
      'Could not reach the review service. Check your connection and try again.',
    )
  }

  // Read the body once as text so we can parse defensively regardless of status.
  const rawText = await response.text().catch(() => '')

  if (!response.ok) {
    // The API returns { error: { code, message } } with safe, client-facing text.
    let message = 'The review could not be completed. Please try again.'
    try {
      const body = JSON.parse(rawText) as { error?: { message?: unknown } }
      if (isNonEmptyString(body?.error?.message)) {
        message = body.error.message
      }
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ReviewError(message)
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawText)
  } catch {
    throw new ReviewError('The review service returned an unreadable response.')
  }

  const result = parseReviewResult(parsedJson)
  if (!result) {
    throw new ReviewError('The review service returned an unexpected response.')
  }
  return result
}

/**
 * Resolves the configured endpoint, or throws a visible, actionable error if none
 * is set. There is deliberately no mock/static fallback: a missing endpoint is a
 * configuration failure the user must see, not something to paper over with fake
 * data.
 */
export function resolveReviewApiUrl(): string {
  const url = getReviewApiUrl()
  if (!url) {
    throw new ReviewError(
      'Review API is not configured. The app could not find a backend endpoint ' +
        '(amplify_outputs.json custom.reviewApiUrl or VITE_REVIEW_API_URL). ' +
        'Deploy the Amplify sandbox and restart the dev server.',
    )
  }
  return url
}
