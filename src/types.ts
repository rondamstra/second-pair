export type Verdict = 'SHIP' | 'REVIEW' | 'STOP'

export type Severity = 'high' | 'medium' | 'low'

export type ScoreKey = 'security' | 'reliability' | 'cost' | 'operability'

export interface Score {
  key: ScoreKey
  label: string
  /** 0-100 */
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
