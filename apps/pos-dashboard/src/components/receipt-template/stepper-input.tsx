import { Button, Input, Label } from '@spree/dashboard-ui'
import { MinusIcon, PlusIcon } from '@spree/dashboard-ui/icons'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

export function StepperInput({
  id: explicitId,
  label,
  value,
  min,
  max,
  step = 1,
  placeholder,
  disabled,
  invalid,
  describedBy,
  fallbackOnStep,
  onChange,
}: {
  id?: string
  label: string
  value: number | null | undefined
  min: number
  max: number
  step?: number
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  fallbackOnStep?: number
  onChange: (next: number | undefined) => void
}) {
  const { t } = useTranslation('pos')
  const generated = useId()
  const id = explicitId ?? generated
  const current = typeof value === 'number' && Number.isFinite(value) ? value : undefined
  const base = current ?? fallbackOnStep ?? min
  const canDecrement = !disabled && (current === undefined || current > min)
  const canIncrement = !disabled && (current === undefined || current < max)

  const roundStep = (raw: number) => {
    const decimals = String(step).split('.')[1]?.length ?? 0
    const clamped = Math.min(max, Math.max(min, raw))
    return Number(clamped.toFixed(decimals))
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0"
          disabled={!canDecrement}
          aria-label={t('receiptTemplates.decrease', { label })}
          onClick={() => onChange(roundStep(current === undefined ? base : current - step))}
        >
          <MinusIcon className="size-3.5" />
        </Button>
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={current ?? ''}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="text-center tabular-nums"
          onChange={(event) => {
            const raw = event.target.value.trim()
            if (raw === '') {
              onChange(undefined)
              return
            }
            const parsed = Number(raw)
            if (Number.isFinite(parsed)) onChange(parsed)
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0"
          disabled={!canIncrement}
          aria-label={t('receiptTemplates.increase', { label })}
          onClick={() => onChange(roundStep(current === undefined ? base : current + step))}
        >
          <PlusIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
