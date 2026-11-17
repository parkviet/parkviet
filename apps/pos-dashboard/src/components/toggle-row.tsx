import { Switch } from '@spree/dashboard-ui'
import type { ReactNode } from 'react'

// A setting row: the switch sits at the start, the name and explanation follow.
export function ToggleRow({
  checked,
  onChange,
  disabled,
  label,
  description,
  extra,
  children,
  switchLabel,
}: {
  checked: boolean
  onChange?: (value: boolean) => void
  disabled?: boolean
  label: ReactNode
  description?: ReactNode
  extra?: ReactNode
  children?: ReactNode
  switchLabel: string
}) {
  return (
    <div className="flex items-start gap-3 py-4">
      <div className="shrink-0 pt-0.5">
        <Switch
          checked={checked}
          disabled={disabled || !onChange}
          aria-label={switchLabel}
          onCheckedChange={(value) => onChange?.(value === true)}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-base font-medium leading-snug">{label}</div>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        {extra}
        {children}
      </div>
    </div>
  )
}
