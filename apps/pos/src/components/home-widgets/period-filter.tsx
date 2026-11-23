import {
  capRange,
  type DayRange,
  matchingOverviewRange,
  OVERVIEW_RANGES,
  type OverviewRange,
  overviewRange,
} from '@shared/overview'
import {
  cn,
  DateRangePanel,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
} from '@spree/dashboard-ui'
import { CalendarIcon, ChevronsUpDownIcon } from '@spree/dashboard-ui/icons'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

const CUSTOM = 'custom' as const
type RangeChoice = OverviewRange | typeof CUSTOM

// A business day (YYYY-MM-DD) as the calendar's local midnight, and back.
const toCalendar = (day: string) => {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}
const fromCalendar = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function rangeText(range: DayRange, locale: string) {
  const format = (day: string) =>
    toCalendar(day).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  return range.from === range.to
    ? format(range.from)
    : `${format(range.from)} – ${format(range.to)}`
}

// The home page's period: quick picks, a calendar for any other range, and
// whether the previous period is compared. Days are the branch's business
// days; `today` is its business day now.
export function PeriodFilter({
  range,
  today,
  compare,
  invalid,
  onRangeChange,
  onCompareChange,
}: {
  range: DayRange
  today: string
  compare: boolean
  // The URL's range cannot be asked for (reversed or too long).
  invalid: boolean
  onRangeChange: (range: DayRange | null) => void
  onCompareChange: (compare: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const [open, setOpen] = useState(false)
  const matched = matchingOverviewRange(range, today)
  const active: RangeChoice = matched ?? CUSTOM
  const label =
    matched === null
      ? `${t('homeFilter.custom')}: ${rangeText(range, i18n.language)}`
      : `${t(`homeFilter.range_${matched}`)} · ${rangeText(range, i18n.language)}`

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${t('homeFilter.period')}: ${label}`}
            className={cn(
              'inline-flex h-9 max-w-full items-center gap-2 rounded-lg border bg-card px-3 text-sm shadow-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              invalid && 'border-destructive',
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
            <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1rem)] p-0">
          <DateRangePanel<RangeChoice>
            key={`${range.from}:${range.to}`}
            presets={[...OVERVIEW_RANGES, CUSTOM].map((key: RangeChoice) => ({
              key,
              label: t(key === CUSTOM ? 'homeFilter.custom' : `homeFilter.range_${key}`),
            }))}
            activePreset={active}
            onPresetSelect={(key) => {
              // "Custom" leaves the calendar open to pick the days.
              if (key === CUSTOM) return
              onRangeChange(key === 'today' ? null : overviewRange(key, today))
              setOpen(false)
            }}
            initialRange={{ from: toCalendar(range.from), to: toCalendar(range.to) }}
            onApply={(picked) => {
              // The calendar cannot bound a range by its length: a longer one is
              // cut to the 366 days the server accepts, ending on the picked day.
              onRangeChange(
                capRange({ from: fromCalendar(picked.from), to: fromCalendar(picked.to) }),
              )
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-2">
        <Switch id={`${id}-compare`} checked={compare} onCheckedChange={onCompareChange} />
        <Label htmlFor={`${id}-compare`} className="text-sm font-normal">
          {t('homeFilter.compare')}
        </Label>
      </div>
      {invalid && (
        <p role="alert" className="w-full text-sm text-destructive">
          {t('homeFilter.invalid')}
        </p>
      )}
    </div>
  )
}
