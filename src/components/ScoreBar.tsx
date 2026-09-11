import type { Score } from '../types'

function band(value: number): 'good' | 'warn' | 'bad' {
  if (value >= 75) return 'good'
  if (value >= 50) return 'warn'
  return 'bad'
}

export function ScoreBar({ score }: { score: Score }) {
  const level = band(score.value)
  return (
    <div
      className={`score-card score-card--${level}`}
      role="meter"
      aria-valuenow={score.value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${score.label} score`}
    >
      <div className="score-card__value">{score.value}</div>
      <div className="score-card__label">{score.label}</div>
      <div className="score-card__track" aria-hidden="true">
        <div
          className={`score-card__fill score-card__fill--${level}`}
          style={{ width: `${score.value}%` }}
        />
      </div>
    </div>
  )
}
