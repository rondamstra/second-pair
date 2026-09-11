import { useId } from 'react'
import { EXAMPLES } from '../examples'

interface ReviewFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
}

export function ReviewForm({ value, onChange, onSubmit, isLoading }: ReviewFormProps) {
  const textareaId = useId()
  const hintId = useId()
  const examplesId = useId()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form__field">
        <label className="form__label" htmlFor={textareaId}>
          Deployment content
        </label>
        <p className="form__hint" id={hintId}>
          Paste your deployment plan, manifest, or release notes. Second Pair reviews
          it and returns a verdict.
        </p>
        <textarea
          id={textareaId}
          className="form__textarea"
          aria-describedby={hintId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={'# deploy.yaml\napiVersion: apps/v1\nkind: Deployment\n...'}
          rows={14}
          spellCheck={false}
          disabled={isLoading}
        />
      </div>

      <div className="examples" role="group" aria-labelledby={examplesId}>
        <span className="examples__label" id={examplesId}>
          Try an example
        </span>
        <div className="examples__chips">
          {EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              className="chip"
              onClick={() => onChange(example.content)}
              disabled={isLoading}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={isLoading || value.trim().length === 0}
        >
          {isLoading ? 'Reviewing…' : 'Review before deploy'}
        </button>
      </div>
    </form>
  )
}
