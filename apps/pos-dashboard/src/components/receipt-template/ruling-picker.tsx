import type { LineRuling } from '@parkviet/pos-shared/receipt-template/types'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

const RULINGS: readonly LineRuling[] = ['none', 'rows', 'grid']

function RulingDiagram({ ruling }: { ruling: LineRuling }) {
  return (
    <svg
      viewBox="0 0 56 36"
      aria-hidden="true"
      className="h-9 w-14 shrink-0 rounded-[4px] border border-border/70 bg-white p-1 text-foreground"
    >
      {/* Header row */}
      <rect x="4" y="4" width="22" height="3" rx="1" fill="currentColor" opacity="0.65" />
      <rect x="38" y="4" width="14" height="3" rx="1" fill="currentColor" opacity="0.65" />
      {/* Item rows */}
      <rect x="4" y="13" width="26" height="2.5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="40" y="13" width="12" height="2.5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="4" y="22" width="20" height="2.5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="40" y="22" width="12" height="2.5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="4" y="30" width="24" height="2.5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="40" y="30" width="12" height="2.5" rx="1" fill="currentColor" opacity="0.4" />

      {ruling === 'rows' ? (
        <>
          <line x1="2" y1="9.5" x2="54" y2="9.5" stroke="currentColor" strokeWidth="1" />
          <line
            x1="2"
            y1="18.5"
            x2="54"
            y2="18.5"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeDasharray="2 1.5"
          />
          <line
            x1="2"
            y1="27"
            x2="54"
            y2="27"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeDasharray="2 1.5"
          />
        </>
      ) : null}

      {ruling === 'grid' ? (
        <>
          <rect
            x="2"
            y="2"
            width="52"
            height="32"
            rx="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <line x1="2" y1="9.5" x2="54" y2="9.5" stroke="currentColor" strokeWidth="1" />
          <line x1="2" y1="18.5" x2="54" y2="18.5" stroke="currentColor" strokeWidth="0.8" />
          <line x1="2" y1="27" x2="54" y2="27" stroke="currentColor" strokeWidth="0.8" />
          <line x1="35" y1="2" x2="35" y2="34" stroke="currentColor" strokeWidth="0.8" />
        </>
      ) : null}
    </svg>
  )
}

export function RulingPicker({
  value,
  defaultValue = 'none',
  disabled,
  onChange,
}: {
  value: LineRuling | undefined
  defaultValue?: LineRuling
  disabled?: boolean
  onChange: (ruling: LineRuling) => void
}) {
  const { t } = useTranslation('pos')
  const name = useId()
  const active = value ?? defaultValue

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 font-medium text-sm">{t('receiptTemplates.lines.ruling')}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {RULINGS.map((option) => {
          const checked = active === option
          return (
            <label
              key={option}
              data-checked={checked ? 'true' : undefined}
              className={`relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                checked
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'bg-background/60 hover:bg-muted/60'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={checked}
                disabled={disabled}
                className="sr-only"
                onChange={() => onChange(option)}
              />
              <RulingDiagram ruling={option} />
              <span className="font-medium text-sm">
                {t(`receiptTemplates.lines.ruling_${option}`)}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
