import { describeFailure } from '@parkviet/pos-shared/request-failure'
import {
  Button,
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  cn,
  Progress,
  Skeleton,
} from '@spree/dashboard-ui'
import {
  ChevronRightIcon,
  MinusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from '@spree/dashboard-ui/icons'
import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useId, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { DrillLink } from '../../lib/home-links'

// Chart parts shared by the home widgets, drawn the way the Spree dashboard
// draws its reports: the brand chart blue for the period, a dashed muted
// line for the period before, no chart palette of our own.

export const CURRENT_COLOR = 'var(--chart-2)'
export const PREVIOUS_COLOR = 'var(--muted-foreground)'

// What a query-backed widget shows before its figures: a skeleton while
// loading, the failure with a retry, or a line saying there is nothing yet.
export function QueryState<T>({
  query,
  empty,
  emptyText,
  skeleton = 'chart',
  children,
}: {
  query: UseQueryResult<T>
  // Whether the loaded data has nothing to draw.
  empty?: (data: T) => boolean
  emptyText?: string
  skeleton?: 'chart' | 'figure' | 'rows'
  children: (data: T) => ReactNode
}) {
  const { t } = useTranslation()
  if (query.isError && !query.data)
    return (
      <div role="alert" className="flex flex-1 flex-col items-start justify-center gap-2">
        <p className="line-clamp-2 text-sm text-destructive">{describeFailure(query.error, t)}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t('retry')}
        </Button>
      </div>
    )
  if (query.data === undefined)
    return (
      <div role="status" aria-label={t('waiting')} className="flex flex-1 flex-col gap-2">
        {skeleton === 'figure' ? (
          <Skeleton className="mt-auto h-8 w-32" />
        ) : skeleton === 'rows' ? (
          ['a', 'b', 'c'].map((key) => <Skeleton key={key} className="h-6 w-full" />)
        ) : (
          <Skeleton className="min-h-16 w-full flex-1" />
        )}
      </div>
    )
  if (empty?.(query.data))
    return (
      <p className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
        {emptyText ?? t('homeCharts.empty')}
      </p>
    )
  return (
    // Figures of the previous period stay while the next ones load, dimmed.
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-3 transition-opacity',
        query.isPlaceholderData && 'opacity-60',
      )}
      aria-busy={query.isFetching || undefined}
    >
      {children(query.data)}
    </div>
  )
}

// Change against the previous period: an arrow and the percentage, green when
// the move is good for the business (fewer returns are good), a dash at zero
// and nothing without a baseline. `against` names the period compared with.
export function GrowthBadge({
  change,
  against,
  goodWhenUp = true,
}: {
  change: number | null
  against: string
  goodWhenUp?: boolean
}) {
  const { i18n } = useTranslation()
  if (change === null) return null
  const label = `${change > 0 ? '+' : ''}${change.toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%`
  const good = change > 0 === goodWhenUp
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        change === 0 ? 'text-muted-foreground' : good ? 'text-success' : 'text-danger',
      )}
      title={against}
    >
      {change === 0 ? (
        <MinusIcon className="size-3" aria-hidden />
      ) : change > 0 ? (
        <TrendingUpIcon className="size-3" aria-hidden />
      ) : (
        <TrendingDownIcon className="size-3" aria-hidden />
      )}
      {label}
      <span className="sr-only"> {against}</span>
    </span>
  )
}

// Short axis numbers ("1,2 Tr", "12K").
export function compactNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

export type SeriesPoint = {
  // Unique key of the point (an ISO day, an hour).
  key: string
  // Axis label of the point.
  label: string
  // Tooltip heading of the point.
  title: string
  current: number
  previous?: number | null
}

// A series over time as bars or a line, with the previous period as a dashed
// line beside it. Clicking a point, or pressing Enter on the point picked
// with the arrow keys, reports its index.
export function SeriesChart({
  data,
  mode,
  compare,
  currentLabel,
  previousLabel,
  format,
  onPick,
}: {
  data: readonly SeriesPoint[]
  mode: 'bar' | 'line'
  compare: boolean
  currentLabel: string
  previousLabel: string
  // Tooltip value of a point.
  format: (value: number) => string
  onPick?: (index: number) => void
}) {
  const { t, i18n } = useTranslation()
  const hintId = useId()
  // The point the tooltip shows, so Enter opens what the reader sees.
  const active = useRef<string | null>(null)
  const byKey = useMemo(() => new Map(data.map((point, index) => [point.key, index])), [data])
  const config: ChartConfig = {
    current: { label: currentLabel, color: CURRENT_COLOR },
    previous: { label: previousLabel, color: PREVIOUS_COLOR },
  }
  const pick = (index: number | undefined) => {
    if (onPick && index !== undefined && index >= 0 && index < data.length) onPick(index)
  }
  return (
    // The chart fills the space the widget leaves it, with a floor for the
    // single column, where cells take their content's height.
    // biome-ignore lint/a11y/noStaticElementInteractions: Enter reaches here from the focusable chart surface inside
    <div
      className="relative min-h-44 flex-1"
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || active.current === null) return
        event.preventDefault()
        pick(byKey.get(active.current))
      }}
    >
      {onPick && (
        <p id={hintId} className="sr-only">
          {t('homeCharts.pickHint')}
        </p>
      )}
      <ChartContainer
        config={config}
        className={cn('absolute inset-0 aspect-auto', onPick && '[&_svg]:cursor-pointer')}
        aria-describedby={onPick ? hintId : undefined}
      >
        <ComposedChart
          data={data as SeriesPoint[]}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          onClick={(state) => {
            // A click on empty space has no active point.
            const index = state?.activeTooltipIndex
            if (index === null || index === undefined || index === '') return
            const position = Number(index)
            if (Number.isInteger(position)) pick(position)
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="key"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
            tickFormatter={(key: string) => data[byKey.get(key) ?? -1]?.label ?? key}
          />
          <YAxis
            width={44}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickFormatter={(value: number) => compactNumber(value, i18n.language)}
          />
          <ChartTooltip
            cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
            content={({ active: shown, payload, label }) => {
              const key = label === undefined || label === null ? null : String(label)
              active.current = shown ? key : null
              return (
                <ChartTooltipContent
                  active={shown}
                  label={key ?? ''}
                  labelFormatter={(value) => data[byKey.get(value) ?? -1]?.title ?? value}
                  payload={payload?.map((item) => ({
                    dataKey: String(item.dataKey ?? ''),
                    name: String(item.name ?? ''),
                    color: item.color,
                    value: typeof item.value === 'number' ? format(item.value) : undefined,
                  }))}
                />
              )
            }}
          />
          {mode === 'bar' ? (
            <Bar
              dataKey="current"
              fill="var(--color-current)"
              opacity={0.85}
              activeBar={{ opacity: 1 }}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
            />
          ) : (
            <Line
              dataKey="current"
              stroke="var(--color-current)"
              strokeWidth={2}
              dot={data.length <= 31}
              type="monotone"
              isAnimationActive={false}
            />
          )}
          {compare && (
            <Line
              dataKey="previous"
              stroke="var(--color-previous)"
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              dot={false}
              type="monotone"
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}

// The legend under a compared series; `previous` names the compared days.
export function SeriesLegend({ previous }: { previous: string | null }) {
  const { t } = useTranslation()
  if (!previous) return null
  return (
    <div className="flex flex-none flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px]" style={{ background: CURRENT_COLOR }} />
        {t('homeCharts.current')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-0 w-4 border-t-2 border-dashed"
          style={{ borderColor: PREVIOUS_COLOR }}
        />
        {previous}
      </span>
    </div>
  )
}

// A segmented choice among a few values, as pressed toggle buttons in a
// named group on the pill track of the dashboard tabs.
export function OptionToggle<T extends string>({
  value,
  choices,
  label,
  onChange,
  render,
}: {
  value: T
  choices: readonly T[]
  label: string
  onChange: (value: T) => void
  render: (choice: T) => ReactNode
}) {
  return (
    <fieldset className="inline-flex w-fit items-center gap-0.5 rounded-full bg-track-recessed p-0.5 shadow-[inset_0_0_0_1px_var(--border-subtle)]">
      <legend className="sr-only">{label}</legend>
      {choices.map((choice) => {
        const pressed = choice === value
        return (
          <button
            key={choice}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(choice)}
            className={cn(
              'inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-sm font-medium whitespace-nowrap outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ring)_15%,transparent)]',
              pressed
                ? 'bg-card text-foreground shadow-[0_0_0_1px_var(--card-edge)] dark:bg-accent-strong'
                : 'text-muted-foreground hover:bg-accent-strong hover:text-foreground',
            )}
          >
            {render(choice)}
          </button>
        )
      })}
    </fieldset>
  )
}

export type RankedRow = {
  key: string
  label: ReactNode
  // Secondary line under the label.
  detail?: ReactNode
  value: number
  // The figure shown at the end of the row.
  display: ReactNode
  link?: DrillLink
}

// Rows with a bar for their share of the largest, like the Spree home
// rankings. A row with a link opens it.
export function RankedRows({ rows, label }: { rows: readonly RankedRow[]; label: string }) {
  const max = Math.max(0, ...rows.map((row) => row.value))
  return (
    <ol className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label={label}>
      {rows.map((row) => {
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium">{row.label}</span>
              <span className="shrink-0 text-sm tabular-nums">{row.display}</span>
            </span>
            {row.detail && (
              <span className="truncate text-xs text-muted-foreground">{row.detail}</span>
            )}
            <Progress
              className="h-1.5"
              value={max > 0 ? Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0) : 0}
            />
          </>
        )
        const frame = 'flex flex-col gap-1 rounded-md px-1.5 py-1'
        return (
          <li key={row.key}>
            {row.link ? (
              <Link
                to={row.link.to as never}
                search={row.link.search as never}
                className={cn(
                  frame,
                  'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                )}
              >
                {body}
              </Link>
            ) : (
              <div className={frame}>{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// A link to the page behind a widget, at the end of its title row; only the
// arrow on a narrow card, so the title keeps its room.
export function DrillAction({ link, name }: { link: DrillLink; name: string }) {
  const { t } = useTranslation()
  const label = t('homeCharts.detailsOf', { name })
  return (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0 text-muted-foreground"
      title={label}
      asChild
    >
      <Link to={link.to as never} search={link.search as never} aria-label={label}>
        <span className="hidden @[20rem]/card:inline">{t('homeCharts.details')}</span>
        <ChevronRightIcon />
      </Link>
    </Button>
  )
}
