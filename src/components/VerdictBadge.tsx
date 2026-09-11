import type { Verdict } from '../types'

interface VerdictMeta {
  label: string
  directive: string
  glyph: string
}

const VERDICT_META: Record<Verdict, VerdictMeta> = {
  SHIP: {
    label: 'Ship',
    directive: 'Safe to deploy',
    glyph: '✓',
  },
  REVIEW: {
    label: 'Review',
    directive: 'Deploy with mitigations',
    glyph: '!',
  },
  STOP: {
    label: 'Stop',
    directive: 'Do not deploy yet',
    glyph: '✕',
  },
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const meta = VERDICT_META[verdict]
  return (
    <div className={`verdict verdict--${verdict}`} role="status">
      <span className="verdict__glyph" aria-hidden="true">
        {meta.glyph}
      </span>
      <span className="verdict__text">
        <span className="verdict__label">{meta.label}</span>
        <span className="verdict__directive">{meta.directive}</span>
      </span>
    </div>
  )
}
