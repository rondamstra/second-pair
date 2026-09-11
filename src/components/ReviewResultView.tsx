import type { ReviewResult } from '../types'
import { VerdictBadge } from './VerdictBadge'
import { ScoreBar } from './ScoreBar'

export function ReviewResultView({ result }: { result: ReviewResult }) {
  return (
    <div className="result">
      <section className="result__verdict" aria-labelledby="verdict-heading">
        <h3 id="verdict-heading" className="section__title">
          Verdict
        </h3>
        <VerdictBadge verdict={result.verdict} />
        <p className="result__summary">{result.summary}</p>
      </section>

      <section className="result__scores" aria-labelledby="scores-heading">
        <h3 id="scores-heading" className="section__title">
          Scores
        </h3>
        <div className="scores__grid">
          {result.scores.map((score) => (
            <ScoreBar key={score.key} score={score} />
          ))}
        </div>
      </section>

      <section className="result__issues" aria-labelledby="issues-heading">
        <h3 id="issues-heading" className="section__title">
          Issues <span className="section__count">{result.issues.length}</span>
        </h3>
        <ul className="issues">
          {result.issues.map((issue) => (
            <li key={issue.id} className={`issue issue--${issue.severity}`}>
              <div className="issue__head">
                <span className={`tag tag--${issue.severity}`}>{issue.severity}</span>
                <p className="issue__title">{issue.title}</p>
              </div>
              <p className="issue__detail">{issue.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="result__split">
        <section className="result__checklist" aria-labelledby="checklist-heading">
          <h3 id="checklist-heading" className="section__title">
            Checklist
          </h3>
          <ul className="checklist">
            {result.checklist.map((item) => (
              <li
                key={item.id}
                className={`checklist__item checklist__item--${item.done ? 'done' : 'pending'}`}
              >
                <span className="checklist__mark" aria-hidden="true">
                  {item.done ? '✓' : '×'}
                </span>
                <span className="checklist__label">{item.label}</span>
                <span className="visually-hidden">
                  {item.done ? ' (complete)' : ' (incomplete)'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="result__strengths" aria-labelledby="strengths-heading">
          <h3 id="strengths-heading" className="section__title">
            Strengths
          </h3>
          <ul className="strengths">
            {result.strengths.map((strength, index) => (
              <li key={index} className="strengths__item">
                {strength}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
