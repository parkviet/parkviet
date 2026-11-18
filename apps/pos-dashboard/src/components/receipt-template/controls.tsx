import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@spree/dashboard-ui'
import { type ReactNode, useId } from 'react'

export function Choice<T extends string>({
  label,
  value,
  options,
  disabled,
  invalid,
  describedBy,
  hideLabel = false,
  className,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string; disabled?: boolean }[]
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  hideLabel?: boolean
  className?: string
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className={['grid gap-2', className].filter(Boolean).join(' ')}>
      <Label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      <Select
        value={value}
        items={options}
        disabled={disabled}
        onValueChange={(next) => onChange(next as T)}
      >
        <SelectTrigger id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function SegmentedChoice<T extends string>({
  label,
  value,
  options,
  disabled,
  invalid,
  describedBy,
  hideLabel = false,
  className,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string; disabled?: boolean }[]
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  hideLabel?: boolean
  className?: string
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className={['grid gap-2', className].filter(Boolean).join(' ')}>
      <Label id={`${id}-label`} className={hideLabel ? 'sr-only' : undefined}>
        {label}
      </Label>
      <RadioGroup
        className="inline-flex w-full flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/50 p-1"
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as T)}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
      >
        {options.map((option) => (
          <div
            key={option.value}
            data-disabled={disabled || option.disabled || undefined}
            className="relative flex min-w-0 flex-1 items-center justify-center rounded-md px-2.5 py-1.5 text-center text-sm text-muted-foreground transition-all hover:text-foreground has-focus-visible:ring-2 has-focus-visible:ring-blue-500/40 has-data-[checked]:bg-card has-data-[checked]:font-medium has-data-[checked]:text-foreground has-data-[checked]:shadow-xs data-[disabled=true]:opacity-50"
          >
            <RadioGroupItem
              id={`${id}-${option.value}`}
              value={option.value}
              disabled={option.disabled}
              aria-invalid={invalid || undefined}
              className="absolute inset-0 z-10 size-full cursor-pointer rounded-md border-0 bg-transparent opacity-0 shadow-none"
            />
            <Label
              htmlFor={`${id}-${option.value}`}
              className="pointer-events-none truncate font-inherit text-inherit"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}

export function Check({
  children,
  checked,
  disabled,
  onChange,
  describedBy,
}: {
  children: ReactNode
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  describedBy?: string
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-3 py-1">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-describedby={describedBy}
      />
      <Label htmlFor={id} className="cursor-pointer">
        {children}
      </Label>
    </div>
  )
}

export function Problem({ children, id }: { children: ReactNode; id?: string }) {
  return children ? (
    <small id={id} data-template-error className="text-destructive">
      {children}
    </small>
  ) : null
}

export function Notice({ text, failed = false }: { text: string; failed?: boolean }) {
  return (
    <Alert variant={failed ? 'destructive' : 'default'} role={failed ? 'alert' : 'status'}>
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  )
}

export function PageState({
  title,
  error,
  retry,
  retryLabel,
}: {
  title: string
  error?: string
  retry?: () => void
  retryLabel?: string
}) {
  return (
    <div className="grid gap-3 rounded-xl border bg-card p-6" role={error ? 'alert' : 'status'}>
      <p>{title}</p>
      {error ? <p className="text-muted-foreground">{error}</p> : null}
      {retry ? (
        <Button variant="outline" onClick={retry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
