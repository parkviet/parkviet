import {
  Combobox,
  ComboboxButtonTrigger,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxSearch,
  ComboboxTriggerPlaceholder,
} from '@spree/dashboard-ui'
import { useMemo } from 'react'

export type CatalogOption = { code: string; name: string }

// Search without Vietnamese accents: "thue ha noi" finds "Thuế thành phố Hà Nội".
function fold(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase()
}

function matches(option: CatalogOption, query: string) {
  const typed = fold(query.trim())
  return typed === '' || fold(`${option.code} ${option.name}`).includes(typed)
}

/**
 * Searchable picker over a catalog list (code + name). Value is the code. A
 * saved code missing from the catalog stays shown so it is not lost silently.
 */
export function CatalogCombobox({
  id,
  value,
  options,
  onValueChange,
  placeholder,
  searchPlaceholder,
  empty,
  disabled,
  invalid,
  describedBy,
}: {
  id: string
  value: string
  options: CatalogOption[]
  onValueChange: (code: string) => void
  placeholder: string
  searchPlaceholder: string
  empty: string
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
}) {
  const items = useMemo(
    () =>
      !value || options.some((option) => option.code === value)
        ? options
        : [{ code: value, name: value }, ...options],
    [options, value],
  )
  const selected = items.find((option) => option.code === value) ?? null
  return (
    <Combobox
      items={items}
      value={selected}
      disabled={disabled}
      onValueChange={(option: CatalogOption | null) => onValueChange(option?.code ?? '')}
      itemToStringLabel={(option: CatalogOption | null) =>
        option ? `${option.code} – ${option.name}` : ''
      }
      itemToStringValue={(option: CatalogOption | null) => option?.code ?? ''}
      filter={matches}
    >
      <ComboboxButtonTrigger
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        {selected ? (
          <span className="truncate">
            {selected.code} – {selected.name}
          </span>
        ) : (
          <ComboboxTriggerPlaceholder>{placeholder}</ComboboxTriggerPlaceholder>
        )}
      </ComboboxButtonTrigger>
      <ComboboxContent>
        <ComboboxSearch placeholder={searchPlaceholder} />
        <ComboboxEmpty>{empty}</ComboboxEmpty>
        <ComboboxList>
          {(option: CatalogOption) => (
            <ComboboxItem key={option.code} value={option}>
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {option.code}
                </span>
                <span className="truncate">{option.name}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
