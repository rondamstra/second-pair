import {
  SCORE_KEYS,
  SEVERITIES,
  VERDICTS,
  type ChecklistItem,
  type Issue,
  type ReviewResult,
  type Score,
  type ScoreKey,
  type Severity,
  type Verdict,
} from './types.js'

/**
 * JSON Schema describing the exact review object we require from the model.
 * This is embedded in the prompt so the model targets the correct shape, and
 * mirrors the runtime validation performed by `parseReviewResult`.
 */
export const REVIEW_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'summary', 'scores', 'issues', 'checklist', 'strengths'],
  properties: {
    verdict: { type: 'string', enum: [...VERDICTS] },
    summary: { type: 'string', minLength: 1, maxLength: 1000 },
    scores: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'label', 'value'],
        properties: {
          key: { type: 'string', enum: [...SCORE_KEYS] },
          label: { type: 'string', minLength: 1 },
          value: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
    },
    issues: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'severity', 'title', 'detail'],
        properties: {
          id: { type: 'string', minLength: 1 },
          severity: { type: 'string', enum: [...SEVERITIES] },
          title: { type: 'string', minLength: 1 },
          detail: { type: 'string', minLength: 1 },
        },
      },
    },
    checklist: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'done'],
        properties: {
          id: { type: 'string', minLength: 1 },
          label: { type: 'string', minLength: 1 },
          done: { type: 'boolean' },
        },
      },
    },
    strengths: {
      type: 'array',
      maxItems: 50,
      items: { type: 'string', minLength: 1 },
    },
  },
} as const

/** Raised when the model output does not conform to the review contract. */
export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaValidationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SchemaValidationError(`${path} must be a non-empty string`)
  }
  return value
}

function requireIntInRange(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new SchemaValidationError(`${path} must be an integer between ${min} and ${max}`)
  }
  return value
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new SchemaValidationError(`${path} must be an array`)
  }
  return value
}

function parseScore(raw: unknown, index: number): Score {
  const path = `scores[${index}]`
  if (!isRecord(raw)) throw new SchemaValidationError(`${path} must be an object`)
  if (!isOneOf<ScoreKey>(raw.key, SCORE_KEYS)) {
    throw new SchemaValidationError(`${path}.key must be one of ${SCORE_KEYS.join(', ')}`)
  }
  return {
    key: raw.key,
    label: requireString(raw.label, `${path}.label`),
    value: requireIntInRange(raw.value, `${path}.value`, 0, 100),
  }
}

function parseIssue(raw: unknown, index: number): Issue {
  const path = `issues[${index}]`
  if (!isRecord(raw)) throw new SchemaValidationError(`${path} must be an object`)
  if (!isOneOf<Severity>(raw.severity, SEVERITIES)) {
    throw new SchemaValidationError(`${path}.severity must be one of ${SEVERITIES.join(', ')}`)
  }
  return {
    id: requireString(raw.id, `${path}.id`),
    severity: raw.severity,
    title: requireString(raw.title, `${path}.title`),
    detail: requireString(raw.detail, `${path}.detail`),
  }
}

function parseChecklistItem(raw: unknown, index: number): ChecklistItem {
  const path = `checklist[${index}]`
  if (!isRecord(raw)) throw new SchemaValidationError(`${path} must be an object`)
  if (typeof raw.done !== 'boolean') {
    throw new SchemaValidationError(`${path}.done must be a boolean`)
  }
  return {
    id: requireString(raw.id, `${path}.id`),
    label: requireString(raw.label, `${path}.label`),
    done: raw.done,
  }
}

/**
 * Validates untrusted model output and returns a well-typed `ReviewResult`.
 * Throws `SchemaValidationError` on any deviation from the contract.
 *
 * The scores array must contain exactly the four canonical dimensions, each
 * present exactly once.
 */
export function parseReviewResult(raw: unknown): ReviewResult {
  if (!isRecord(raw)) {
    throw new SchemaValidationError('response must be a JSON object')
  }

  const verdict: Verdict = isOneOf<Verdict>(raw.verdict, VERDICTS)
    ? raw.verdict
    : (() => {
        throw new SchemaValidationError(`verdict must be one of ${VERDICTS.join(', ')}`)
      })()

  const summary = requireString(raw.summary, 'summary')

  const scores = requireArray(raw.scores, 'scores').map(parseScore)
  const seenKeys = new Set(scores.map((s) => s.key))
  if (scores.length !== SCORE_KEYS.length || seenKeys.size !== SCORE_KEYS.length) {
    throw new SchemaValidationError('scores must contain each dimension exactly once')
  }
  for (const key of SCORE_KEYS) {
    if (!seenKeys.has(key)) {
      throw new SchemaValidationError(`scores is missing dimension "${key}"`)
    }
  }

  const issues = requireArray(raw.issues, 'issues').map(parseIssue)
  const checklist = requireArray(raw.checklist, 'checklist').map(parseChecklistItem)

  const strengths = requireArray(raw.strengths, 'strengths').map((s, i) =>
    requireString(s, `strengths[${i}]`),
  )

  return { verdict, summary, scores, issues, checklist, strengths }
}
