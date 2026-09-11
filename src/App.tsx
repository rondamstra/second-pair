import { useState } from 'react'
import { Header } from './components/Header'
import { ReviewForm } from './components/ReviewForm'
import { ResultPanel, type ReviewStatus } from './components/ResultPanel'
import { requestReview, resolveReviewApiUrl } from './reviewApi'
import type { ReviewResult } from './types'

export default function App() {
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<ReviewStatus>('idle')
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runReview() {
    setStatus('loading')
    setError(null)
    try {
      // Always calls the deployed backend. resolveReviewApiUrl() throws a visible
      // error if no endpoint is configured — there is no mock/static fallback.
      const review = await requestReview(resolveReviewApiUrl(), content)
      setResult(review)
      setStatus('success')
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Unknown error.')
      setStatus('error')
    }
  }

  return (
    <div className="app">
      <div className="app__shell">
        <Header />
        <main className="layout">
          <div className="layout__input">
            <ReviewForm
              value={content}
              onChange={setContent}
              onSubmit={runReview}
              isLoading={status === 'loading'}
            />
          </div>
          <div className="layout__output">
            <ResultPanel
              status={status}
              result={result}
              error={error}
              onRetry={runReview}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
