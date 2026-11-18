import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@spree/dashboard-ui'
import type { TaxOption } from '../hooks/use-tax-regime'
import { optionGroups } from '../schemas/tax-regime'
import { TopologyField } from './topology-fields'

// A tax option picker: options grouped by industry (each with its two
// variants), the chosen option's industry named under the field. Deduction
// options have no industry, so they list flat.
export function TaxOptionSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  error,
}: {
  label: string
  value: string
  options: TaxOption[]
  onChange: (value: string) => void
  disabled?: boolean
  error?: string
}) {
  const selected = options.find((item) => item.option === value)
  const groups = optionGroups(options)
  const grouped = options.some((item) => item.industry !== null)
  return (
    <TopologyField label={label} error={error} hint={selected?.industry_name ?? undefined}>
      {(id, describedBy) => (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id} aria-describedby={describedBy} aria-invalid={Boolean(error)}>
            <SelectValue>{selected?.label ?? '—'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {grouped
              ? groups.map((group) => (
                  <SelectGroup key={group.key}>
                    <SelectLabel>{group.name}</SelectLabel>
                    {group.options.map((item) => (
                      <SelectItem key={item.option} value={item.option}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))
              : options.map((item) => (
                  <SelectItem key={item.option} value={item.option}>
                    {item.label}
                  </SelectItem>
                ))}
          </SelectContent>
        </Select>
      )}
    </TopologyField>
  )
}
