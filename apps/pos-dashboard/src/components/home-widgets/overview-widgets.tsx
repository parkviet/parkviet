import { formatMoney } from '@parkviet/pos-shared/money'
import { orderSourceKey } from '@parkviet/pos-shared/order-source'
import {
  alignPrevious,
  chartNumber,
  dayHours,
  OVERVIEW_STATUSES,
  type Overview,
  type OverviewDay,
  type OverviewTopItem,
  type OverviewTotals,
  percentChange,
} from '@parkviet/pos-shared/overview'
import { Button, cn } from '@spree/dashboard-ui'
import { ChartColumnIcon, PackageXIcon, TrendingUpIcon } from '@spree/dashboard-ui/icons'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useActiveUnits } from '../../hooks/use-master-data'
import { type OverviewPeriod, useOverview } from '../../hooks/use-overview'
import {
  type DrillLink,
  orderSourceLink,
  ordersLink,
  salesDayLink,
  salesReportLink,
  stockAlertsLink,
} from '../../lib/home-links'
import { unitLabel } from '../setup-preview-step'
import {
  DrillAction,
  GrowthBadge,
  OptionToggle,
  QueryState,
  type RankedRow,
  RankedRows,
  SeriesChart,
  SeriesLegend,
  type SeriesPoint,
} from './charts'
import type { WidgetContext, WidgetProps } from './registry'
import { WidgetCard } from './widget-card'

// Home widgets drawn from the branch overview (GET /pos/overview). They all
// read the same query, so the page asks the server once per period.

type OverviewBodyProps = {
  context: WidgetContext
  // The period to read instead of the page's (for figures that do not
  // depend on it).
  period?: OverviewPeriod | null
  skeleton?: 'chart' | 'figure' | 'rows'
  empty?: (overview: Overview) => boolean
  emptyText?: string
  children: (overview: Overview) => ReactNode
}

// The overview for the page's period, with its loading, failure and empty
// states; a period the page cannot ask for is said so.
function OverviewBody({
  context,
  period = context.period,
  skeleton,
  empty,
  emptyText,
  children,
}: OverviewBodyProps) {
  const { t } = useTranslation()
  const query = useOverview(context.branchId, period)
  if (!period)
    return (
      <p className="flex flex-1 items-center text-sm text-muted-foreground">
        {t('homeCharts.chooseRange')}
      </p>
    )
  return (
    <QueryState query={query} skeleton={skeleton} empty={empty} emptyText={emptyText}>
      {children}
    </QueryState>
  )
}

// The page's period, or today's while the chosen one is invalid (links then
// open the report on its own default).
const rangeOf = (context: WidgetContext) =>
  context.period ?? { from: context.today, to: context.today }

const dayDate = (date: string) => new Date(`${date}T00:00:00Z`)
const shortDay = (date: string, locale: string) =>
  dayDate(date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const longDay = (date: string, locale: string) =>
  dayDate(date).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
const fullDay = (date: string, locale: string) =>
  dayDate(date).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })

// What the period is compared with: the same number of days just before it,
// named with their dates. Null without a comparison.
function useComparison(overview: Overview) {
  const { t, i18n } = useTranslation()
  const { previous_from: from, previous_to: to } = overview
  if (!from || !to) return null
  const range =
    from === to
      ? fullDay(from, i18n.language)
      : `${fullDay(from, i18n.language)} – ${fullDay(to, i18n.language)}`
  const count = Math.round((dayDate(to).getTime() - dayDate(from).getTime()) / 86_400_000) + 1
  return {
    // Beside a figure's change: "so với 7 ngày liền trước (…)".
    against: t('homeCharts.vsPrevious', { count, range }),
    // The dashed series of a chart.
    legend: t('homeCharts.previousDays', { count, range }),
  }
}

type Metric = keyof OverviewTotals

export type KpiSpec = {
  metric: Metric
  money: boolean
  // Whether a rise is good news (more returns is not).
  goodWhenUp: boolean
  link: (context: WidgetContext) => DrillLink
}

function KpiFigure({
  spec,
  title,
  context,
  overview,
}: {
  spec: KpiSpec
  title: string
  context: WidgetContext
  overview: Overview
}) {
  const { t, i18n } = useTranslation()
  const comparison = useComparison(overview)
  const value = overview.totals[spec.metric]
  const link = spec.link(context)
  // The figure is the way into the report, leaving the narrow title row to
  // the title.
  return (
    <Link
      to={link.to as never}
      search={link.search as never}
      aria-label={t('homeCharts.detailsOf', { name: title })}
      title={t('homeCharts.detailsOf', { name: title })}
      className="-mx-1.5 mt-auto flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md px-1.5 py-0.5 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span
        className="max-w-full truncate text-lg font-semibold leading-tight tabular-nums @[13rem]/card:text-2xl"
        data-testid="kpi-value"
      >
        {spec.money
          ? formatMoney(String(value), context.currency)
          : Number(value).toLocaleString(i18n.language)}
      </span>
      {comparison && (
        <GrowthBadge
          change={percentChange(value, overview.previous_totals?.[spec.metric])}
          against={comparison.against}
          goodWhenUp={spec.goodWhenUp}
        />
      )}
    </Link>
  )
}

// One headline figure of the period, with its change against the period
// before when comparing.
export function KpiWidget({
  spec,
  title,
  icon,
  context,
  titleId,
}: WidgetProps & { spec: KpiSpec; title: string; icon: ReactNode }) {
  return (
    <WidgetCard titleId={titleId} title={title} icon={icon}>
      <OverviewBody context={context} skeleton="figure">
        {(overview) => (
          <KpiFigure spec={spec} title={title} context={context} overview={overview} />
        )}
      </OverviewBody>
    </WidgetCard>
  )
}

export const TREND_METRICS = ['revenue', 'orders', 'customers'] as const
type TrendMetric = (typeof TREND_METRICS)[number]
const TREND_TOTAL: Record<TrendMetric, Metric> = {
  revenue: 'sales_total',
  orders: 'orders',
  customers: 'customers',
}
const trendValue = (day: OverviewDay, metric: TrendMetric) =>
  metric === 'revenue' ? chartNumber(day.sales_total) : day[metric]

function pick<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback
}

function TrendBody({
  context,
  overview,
  metric,
  chart,
}: {
  context: WidgetContext
  overview: Overview
  metric: TrendMetric
  chart: 'bar' | 'line'
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const comparison = useComparison(overview)
  const money = metric === 'revenue'
  const format = (value: number) =>
    money
      ? formatMoney(String(Math.round(value)), context.currency)
      : value.toLocaleString(i18n.language)
  const total = overview.totals[TREND_TOTAL[metric]]
  const points: SeriesPoint[] = alignPrevious(overview.by_day, overview.previous_by_day).map(
    ({ day, previous }) => ({
      key: day.date,
      label: shortDay(day.date, i18n.language),
      title: longDay(day.date, i18n.language),
      current: trendValue(day, metric),
      previous: previous ? trendValue(previous, metric) : null,
    }),
  )
  return (
    <>
      <p className="flex flex-none flex-wrap items-baseline gap-x-2">
        <span className="text-xl font-semibold tabular-nums">
          {money
            ? formatMoney(String(total), context.currency)
            : Number(total).toLocaleString(i18n.language)}
        </span>
        {comparison && (
          <GrowthBadge
            change={percentChange(total, overview.previous_totals?.[TREND_TOTAL[metric]])}
            against={comparison.against}
          />
        )}
        {metric === 'customers' && (
          <span className="text-xs text-muted-foreground">{t('homeCharts.customersHint')}</span>
        )}
      </p>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {points.length <= 1 && (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 z-10 mx-auto w-fit max-w-[90%] rounded-md border bg-card px-3 py-1.5 text-center text-sm text-muted-foreground shadow-xs">
            {t('homeCharts.singleDay')}
          </p>
        )}
        <SeriesChart
          data={points}
          mode={chart}
          compare={comparison !== null}
          currentLabel={t(`homeCharts.trend_${metric}`)}
          previousLabel={comparison?.legend ?? ''}
          format={format}
          onPick={(index) => {
            const link = salesDayLink(context.storeId, points[index].key)
            void navigate({ to: link.to as never, search: link.search as never })
          }}
        />
      </div>
      <SeriesLegend previous={comparison?.legend ?? null} />
    </>
  )
}

// Sales, orders or customer visits by business day, as bars or a line, with
// the previous period dashed behind. A day opens its sales.
export function TrendWidget({ context, titleId, options, setOptions }: WidgetProps) {
  const { t } = useTranslation()
  const metric = pick(options.metric, TREND_METRICS, 'revenue')
  const chart = pick(options.chart, ['bar', 'line'] as const, 'bar')
  const title = t('homeWidgets.trend')
  return (
    <WidgetCard
      titleId={titleId}
      title={title}
      icon={<TrendingUpIcon />}
      action={
        <DrillAction link={salesReportLink(context.storeId, rangeOf(context))} name={title} />
      }
    >
      <div className="flex flex-none flex-wrap items-center justify-between gap-2">
        <OptionToggle
          value={metric}
          choices={TREND_METRICS}
          label={t('homeCharts.metric')}
          onChange={(next) => setOptions({ ...options, metric: next })}
          render={(choice) => t(`homeCharts.trend_${choice}`)}
        />
        <fieldset className="flex gap-1">
          <legend className="sr-only">{t('homeCharts.chartType')}</legend>
          {(['bar', 'line'] as const).map((type) => (
            <Button
              key={type}
              type="button"
              size="icon-sm"
              variant={chart === type ? 'outline' : 'ghost'}
              aria-pressed={chart === type}
              aria-label={t(`homeCharts.chart_${type}`)}
              title={t(`homeCharts.chart_${type}`)}
              onClick={() => setOptions({ ...options, chart: type })}
            >
              {type === 'bar' ? <ChartColumnIcon /> : <TrendingUpIcon />}
            </Button>
          ))}
        </fieldset>
      </div>
      <OverviewBody context={context}>
        {(overview) => (
          <TrendBody context={context} overview={overview} metric={metric} chart={chart} />
        )}
      </OverviewBody>
    </WidgetCard>
  )
}

// Sales by the hour they completed, over the branch's business day: from
// the hour it starts (the day cutoff) round to the hour before.
export function HourlyWidget({ context, titleId }: WidgetProps) {
  const { t } = useTranslation()
  const title = t('homeWidgets.byHour')
  return (
    <WidgetCard
      titleId={titleId}
      title={title}
      icon={<ChartColumnIcon />}
      action={
        <DrillAction link={salesReportLink(context.storeId, rangeOf(context))} name={title} />
      }
    >
      <OverviewBody context={context} empty={(overview) => overview.by_hour.length === 0}>
        {(overview) => {
          const byHour = new Map(overview.by_hour.map((row) => [row.hour, row]))
          const points: SeriesPoint[] = dayHours(context.dayStartHour).map((hour) => ({
            key: String(hour),
            label: `${hour}h`,
            title: t('homeCharts.hourRange', { from: hour, to: (hour + 1) % 24 }),
            current: chartNumber(byHour.get(hour)?.sales_total),
          }))
          return (
            <SeriesChart
              data={points}
              mode="bar"
              compare={false}
              currentLabel={t('homeCharts.trend_revenue')}
              previousLabel=""
              format={(value) => formatMoney(String(Math.round(value)), context.currency)}
            />
          )
        }}
      </OverviewBody>
    </WidgetCard>
  )
}

// Sales by where the order came from, largest first; a source opens its
// sales.
export function SourceWidget({ context, titleId }: WidgetProps) {
  const { t, i18n } = useTranslation()
  const title = t('homeWidgets.bySource')
  const range = rangeOf(context)
  return (
    <WidgetCard
      titleId={titleId}
      title={title}
      icon={<ChartColumnIcon />}
      action={<DrillAction link={salesReportLink(context.storeId, range)} name={title} />}
    >
      <OverviewBody
        context={context}
        skeleton="rows"
        empty={(overview) => overview.by_source.every((row) => row.orders === 0)}
      >
        {(overview) => (
          <RankedRows
            label={title}
            rows={overview.by_source
              .filter((row) => row.orders > 0)
              .sort((a, b) => chartNumber(b.sales_total) - chartNumber(a.sales_total))
              .map(
                (row): RankedRow => ({
                  key: row.order_source,
                  label: t(orderSourceKey(row.order_source)),
                  detail: t('homeCharts.orderCount', {
                    count: row.orders,
                    formatted: row.orders.toLocaleString(i18n.language),
                  }),
                  value: chartNumber(row.sales_total),
                  display: formatMoney(row.sales_total, context.currency),
                  link: orderSourceLink(context.storeId, range, row.order_source),
                }),
              )}
          />
        )}
      </OverviewBody>
    </WidgetCard>
  )
}

// The period's orders under each status of the order list. The statuses
// overlap (an order can owe and have returns), so each is a share of all
// orders rather than a slice of a whole.
export function StatusWidget({ context, titleId }: WidgetProps) {
  const { t, i18n } = useTranslation()
  const title = t('homeWidgets.byStatus')
  const range = rangeOf(context)
  return (
    <WidgetCard
      titleId={titleId}
      title={title}
      icon={<ChartColumnIcon />}
      action={<DrillAction link={ordersLink(context.storeId, 'all', range)} name={title} />}
    >
      <OverviewBody
        context={context}
        skeleton="rows"
        empty={(overview) => overview.status_counts.all === 0}
      >
        {(overview) => {
          const all = overview.status_counts.all
          return (
            <>
              <RankedRows
                label={title}
                rows={OVERVIEW_STATUSES.map((status) => {
                  const count = overview.status_counts[status]
                  const share = all > 0 ? Math.round((count / all) * 1000) / 10 : 0
                  return {
                    key: status,
                    label: t(`ordersStatus_${status}`),
                    value: count,
                    display: (
                      <>
                        {count.toLocaleString(i18n.language)}
                        {status !== 'all' && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {share.toLocaleString(i18n.language)}%
                          </span>
                        )}
                      </>
                    ),
                    link: ordersLink(context.storeId, status, range),
                  }
                })}
              />
              <p className="flex-none text-xs text-muted-foreground">
                {t('homeCharts.statusNote')}
              </p>
            </>
          )
        }}
      </OverviewBody>
    </WidgetCard>
  )
}

const TOP_BY = ['quantity', 'revenue'] as const

// The five best sellers of the period, by quantity or by revenue, counted in
// each product's stock unit, named as the store names it.
export function TopItemsWidget({ context, titleId, options, setOptions }: WidgetProps) {
  const { t, i18n } = useTranslation()
  const by = pick(options.by, TOP_BY, 'quantity')
  const title = t('homeWidgets.topItems')
  const overview = useOverview(context.branchId, context.period)
  const measured = Boolean(
    overview.data &&
      [...overview.data.top_items.by_quantity, ...overview.data.top_items.by_revenue].some(
        (item) => item.base_unit !== 'item',
      ),
  )
  const units = useActiveUnits(measured)
  const unitNames = new Map((units.data ?? []).map((unit) => [unit.code, unit.name]))
  const quantityLabel = (item: OverviewTopItem) => {
    const quantity = item.quantity.toLocaleString(i18n.language)
    if (item.base_unit === 'item') return quantity
    return `${quantity} ${unitNames.get(item.base_unit) ?? unitLabel(t, item.base_unit)}`
  }
  return (
    <WidgetCard
      titleId={titleId}
      title={title}
      icon={<ChartColumnIcon />}
      action={
        <DrillAction link={salesReportLink(context.storeId, rangeOf(context))} name={title} />
      }
    >
      <OptionToggle
        value={by}
        choices={TOP_BY}
        label={t('homeCharts.rankBy')}
        onChange={(next) => setOptions({ ...options, by: next })}
        render={(choice) => t(`homeCharts.top_${choice}`)}
      />
      <OverviewBody
        context={context}
        skeleton="rows"
        empty={(data) => data.top_items.by_quantity.length === 0}
        emptyText={t('homeCharts.noSales')}
      >
        {(data) => {
          const items = by === 'quantity' ? data.top_items.by_quantity : data.top_items.by_revenue
          return (
            <RankedRows
              label={title}
              rows={items.map((item, index) => ({
                key: item.variant_id ?? `${index}`,
                label: (
                  <>
                    <span className="mr-1.5 text-muted-foreground tabular-nums">{index + 1}.</span>
                    {item.name || item.sku || '—'}
                  </>
                ),
                detail:
                  by === 'quantity'
                    ? formatMoney(item.revenue, context.currency)
                    : quantityLabel(item),
                value: by === 'quantity' ? item.quantity : chartNumber(item.revenue),
                display:
                  by === 'quantity'
                    ? quantityLabel(item)
                    : formatMoney(item.revenue, context.currency),
              }))}
            />
          )
        }}
      </OverviewBody>
    </WidgetCard>
  )
}

// Every business day of the period in a table, newest first; a day opens its
// sales. The total row is the period's, not a sum of the rows: daily
// customer visits do not add up.
export function DailyTableWidget({ context, titleId }: WidgetProps) {
  const { t, i18n } = useTranslation()
  const title = t('homeWidgets.byDay')
  const money = (value: string) => formatMoney(value, context.currency)
  const head = 'px-2 py-1.5 text-left font-normal whitespace-nowrap first:pl-0 last:pr-0'
  const cell = 'px-2 py-1.5 whitespace-nowrap tabular-nums first:pl-0 last:pr-0'
  return (
    <WidgetCard
      titleId={titleId}
      title={title}
      icon={<ChartColumnIcon />}
      action={
        <DrillAction link={salesReportLink(context.storeId, rangeOf(context))} name={title} />
      }
    >
      <OverviewBody context={context} skeleton="rows">
        {(overview) => (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className={head}>
                    {t('homeCharts.day')}
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    {t('homeCharts.trend_orders')}
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    {t('homeCharts.trend_customers')}
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    {t('homeCharts.trend_revenue')}
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    {t('homeWidgets.kpiReturns')}
                  </th>
                  <th scope="col" className={cn(head, 'text-right')}>
                    {t('homeWidgets.kpiNetSales')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...overview.by_day].reverse().map((day) => {
                  const link = salesDayLink(context.storeId, day.date)
                  return (
                    <tr key={day.date} className="border-b last:border-b-0 hover:bg-accent/50">
                      <th scope="row" className={cn(cell, 'text-left font-normal')}>
                        <Link
                          to={link.to as never}
                          search={link.search as never}
                          className="underline-offset-4 hover:underline focus-visible:underline"
                        >
                          {longDay(day.date, i18n.language)}
                        </Link>
                      </th>
                      <td className={cn(cell, 'text-right')}>
                        {day.orders.toLocaleString(i18n.language)}
                      </td>
                      <td className={cn(cell, 'text-right')}>
                        {day.customers.toLocaleString(i18n.language)}
                      </td>
                      <td className={cn(cell, 'text-right')}>{money(day.sales_total)}</td>
                      <td className={cn(cell, 'text-right')}>{money(day.returns_total)}</td>
                      <td className={cn(cell, 'text-right')}>{money(day.net_sales)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-card font-medium">
                <tr className="border-t">
                  <th scope="row" className={cn(cell, 'text-left')}>
                    {t('homeCharts.total')}
                  </th>
                  <td className={cn(cell, 'text-right')}>
                    {overview.totals.orders.toLocaleString(i18n.language)}
                  </td>
                  <td className={cn(cell, 'text-right')}>
                    {overview.totals.customers.toLocaleString(i18n.language)}
                  </td>
                  <td className={cn(cell, 'text-right')}>{money(overview.totals.sales_total)}</td>
                  <td className={cn(cell, 'text-right')}>{money(overview.totals.returns_total)}</td>
                  <td className={cn(cell, 'text-right')}>{money(overview.totals.net_sales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </OverviewBody>
    </WidgetCard>
  )
}

// Today's stock to act on at the branch: sold out, under the low-stock
// threshold, and lots expiring soon. The counts do not depend on the period,
// so while the page's period is invalid they are read with today's.
export function StockAlertsWidget({ context, titleId }: WidgetProps) {
  const { t, i18n } = useTranslation()
  const title = t('homeWidgets.stockAlerts')
  const period = context.period ?? { from: context.today, to: context.today, compare: false }
  return (
    <WidgetCard
      titleId={titleId}
      title={title}
      icon={<PackageXIcon />}
      action={<DrillAction link={stockAlertsLink(context.storeId)} name={title} />}
    >
      <OverviewBody
        context={context}
        period={period}
        skeleton="rows"
        empty={(overview) => overview.stock_alerts === null}
        emptyText={t('homeCharts.stockUnavailable')}
      >
        {(overview) => {
          const alerts = overview.stock_alerts
          if (!alerts) return null
          const tiles = [
            { key: 'out', label: t('homeCharts.outOfStock'), count: alerts.out_of_stock },
            { key: 'low', label: t('homeCharts.lowStock'), count: alerts.low_stock },
            {
              key: 'expiring',
              label: t('homeCharts.expiringSoon', { days: alerts.near_expiry_days }),
              count: alerts.expiring_soon,
            },
          ]
          return (
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] content-start gap-2">
              {tiles.map((tile) => (
                <li
                  key={tile.key}
                  className={cn(
                    'flex flex-col justify-between gap-1 rounded-lg border p-3',
                    tile.count > 0 ? 'border-warning-border bg-warning-surface' : 'bg-muted/30',
                  )}
                >
                  <span className="text-sm text-muted-foreground">{tile.label}</span>
                  <span className="text-2xl font-semibold tabular-nums">
                    {tile.count.toLocaleString(i18n.language)}
                  </span>
                </li>
              ))}
            </ul>
          )
        }}
      </OverviewBody>
    </WidgetCard>
  )
}
