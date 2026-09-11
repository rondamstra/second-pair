/**
 * Domain types for a Second Pair review. These intentionally mirror the frontend
 * `ReviewResult` contract so the API response can be consumed directly by the UI.
 */

export type Verdict = 'SHIP' | 'REVIEW' | 'STOP'

export type Severity = 'high' | 'medium' | 'low'

export type ScoreKey = 'security' | 'reliability' | 'cost' | 'operability'

export interface Score {
  key: ScoreKey
  label: string
  /** Integer 0-100. */
  value: number
}

export interface Issue {
  id: string
  severity: Severity
  title: string
  detail: string
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface ReviewResult {
  verdict: Verdict
  summary: string
  scores: Score[]
  issues: Issue[]
  checklist: ChecklistItem[]
  strengths: string[]
}

/** The four score dimensions, in canonical order. */
export const SCORE_KEYS: readonly ScoreKey[] = [
  'security',
  'reliability',
  'cost',
  'operability',
]

export const VERDICTS: readonly Verdict[] = ['SHIP', 'REVIEW', 'STOP']

export const SEVERITIES: readonly Severity[] = ['high', 'medium', 'low']
