import type { ReviewResult } from '../types'
import { ReviewResultView } from './ReviewResultView'

export type ReviewStatus = 'idle' | 'loading' | 'success' | 'error'

interface ResultPanelProps {
  status: ReviewStatus
  result: ReviewResult | null
  error: string | null
  onRetry: () => void
}

export function ResultPanel({ status, result, error, onRetry }: ResultPanelProps) {
  return (
    <section
      className="panel"
      aria-labelledby="result-region-heading"
      aria-live="polite"
      aria-busy={status === 'loading'}
    >
      <h2 id="result-region-heading" className="panel__title">
        Review
      </h2>

      {status === 'idle' && (
        <div className="state state--empty">
          <p className="state__title">No review yet</p>
          <p className="state__text">
            Add your deployment content and run a review to see the verdict, scores,
            issues, checklist, and strengths.
          </p>
        </div>
      )}

      {status === 'loading' && (
        <div className="state state--loading">
          <span className="spinner" aria-hidden="true" />
          <p className="state__text">Reviewing your deployment…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="state state--error" role="alert">
          <p className="state__title">Review failed</p>
          <p className="state__text">{error ?? 'Something went wrong.'}</p>
          <button type="button" className="button button--ghost" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {status === 'success' && result && <ReviewResultView result={result} />}
    </section>
  )
}
