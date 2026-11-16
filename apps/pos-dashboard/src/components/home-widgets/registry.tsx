import { canHandleDeliveries } from '@parkviet/pos-shared/deliveries'
import type { Overview } from '@parkviet/pos-shared/overview'
import { describeFailure } from '@parkviet/pos-shared/request-failure'
import { Badge, Button, Skeleton } from '@spree/dashboard-ui'
import {
  ArrowLeftRightIcon,
  BanknoteIcon,
  ChartColumnIcon,
  ClockIcon,
  HandCoinsIcon,
  ListChecksIcon,
  PackageXIcon,
  PlugIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  StoreIcon,
  TableIcon,
  TrendingUpIcon,
  TruckIcon,
  Undo2Icon,
} from '@spree/dashboard-ui/icons'
import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type AttentionCount,
  useCashRequestsAttention,
  useCreditRequestsAttention,
  useFundsAttention,
  useOpenShiftsAttention,
} from '../../hooks/use-attention'
import { usePendingDeliveryCount } from '../../hooks/use-deliveries'
import { useRefundPendingCount } from '../../hooks/use-orders'
import type { OverviewPeriod } from '../../hooks/use-overview'
import type { WidgetSize, WidgetSizes } from '../../lib/dashboard-layout'
import { salesReportLink } from '../../lib/home-links'
import {
  canReadOrders,
  canReadReports,
  hasCapability,
  type PosAccess,
  visibleNav,
} from '../../lib/pos-access'
import {
  DailyTableWidget,
  HourlyWidget,
  type KpiSpec,
  KpiWidget,
  SourceWidget,
  StatusWidget,
  StockAlertsWidget,
  TopItemsWidget,
  TrendWidget,
} from './overview-widgets'
import { WidgetCard } from './widget-card'

// What a widget reads from the page: the selected branch, the reader and
// the period the page shows (null while the chosen range is invalid).
export type WidgetContext = {
  storeId: string
  branchId: string
  staffId: string | null
  shiftId: string | null
  period: OverviewPeriod | null
  // The branch's business day today.
  today: string
  currency: string
  // The hour the branch's business day starts (its day cutoff).
  dayStartHour: number
}

export type WidgetDefinition = {
  widget: string
  titleKey: string
  // One line describing the widget in the "add widget" sheet.
  hintKey: string
  icon: ReactNode
  size: WidgetSize
  // Whether the reader may see the widget at the selected branch. A widget
  // that does not apply stays in the layout, hidden, keeping its slot.
  visible: (access: PosAccess) => boolean
  // Whether the loaded overview leaves the widget nothing to show at this
  // branch (stock alerts the reader may not see); it is then treated as not
  // applying here.
  unavailable?: (overview: Overview) => boolean
  // Whether the widget reads the branch overview; the page asks for it only
  // while such a widget is on the page.
  usesOverview?: boolean
  // The widget body; `titleId` names the widget's section.
  render: (props: WidgetProps) => ReactNode
}

export type WidgetProps = {
  context: WidgetContext
  titleId: string
  // The widget's own choices kept in the layout (a selected tab).
  options: Readonly<Record<string, unknown>>
  setOptions: (options: Record<string, unknown>) => void
}

const attentionSize: WidgetSize = { w: 4, h: 3, minW: 3, minH: 3, maxW: 6, maxH: 4 }

type AttentionSpec = {
  widget: string
  titleKey: string
  hintKey: string
  icon: ReactNode
  // Dashboard path below the store where the waiting items are handled.
  to: string
  visible: (access: PosAccess) => boolean
  useCount: (context: WidgetContext) => UseQueryResult<AttentionCount | number>
}

// A count of what waits for the reader, with a link to where it is handled.
// The query runs only while the widget is shown.
function AttentionWidget({ spec, context, titleId }: WidgetProps & { spec: AttentionSpec }) {
  const { titleKey, hintKey, icon, to } = spec
  const { t } = useTranslation()
  const query = spec.useCount(context)
  const value = query.data
  const count = typeof value === 'number' ? value : value?.count
  const more = typeof value === 'object' && value.more
  return (
    <WidgetCard titleId={titleId} title={t(titleKey)} icon={icon}>
      <p className="line-clamp-2 text-sm text-muted-foreground">{t(hintKey)}</p>
      <div className="mt-auto flex items-center justify-between gap-3">
        {query.isError ? (
          <p role="alert" className="line-clamp-2 text-sm text-destructive">
            {describeFailure(query.error, t)}
          </p>
        ) : count === undefined ? (
          <Skeleton role="status" aria-label={t('waiting')} className="h-9 w-14" />
        ) : (
          <p className="flex items-center gap-2">
            <span className="text-3xl font-semibold tabular-nums" data-testid="attention-count">
              {more ? `${count}+` : count}
            </span>
            {count > 0 && <Badge variant="warning">{t('attention.waiting')}</Badge>}
          </p>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link to={`/${context.storeId}${to}` as string}>{t('attention.open')}</Link>
        </Button>
      </div>
    </WidgetCard>
  )
}

function attentionWidget(spec: AttentionSpec): WidgetDefinition {
  return {
    widget: spec.widget,
    titleKey: spec.titleKey,
    hintKey: spec.hintKey,
    icon: spec.icon,
    size: attentionSize,
    visible: spec.visible,
    render: (props) => <AttentionWidget spec={spec} {...props} />,
  }
}
const has = (capability: string) => (access: PosAccess) => hasCapability(access, capability)

const kpiSize: WidgetSize = { w: 3, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 }

type KpiDefinition = Pick<WidgetDefinition, 'widget' | 'titleKey' | 'hintKey' | 'icon'> & {
  spec: KpiSpec
}

function TranslatedKpi({
  titleKey,
  ...props
}: WidgetProps & { spec: KpiSpec; titleKey: string; icon: ReactNode }) {
  const { t } = useTranslation()
  return <KpiWidget title={t(titleKey)} {...props} />
}

// A headline figure of the sales report; readers of reports see it.
function kpiWidget({ spec, ...definition }: KpiDefinition): WidgetDefinition {
  return {
    ...definition,
    size: kpiSize,
    visible: canReadReports,
    usesOverview: true,
    render: (props) => (
      <TranslatedKpi spec={spec} titleKey={definition.titleKey} icon={definition.icon} {...props} />
    ),
  }
}

const salesOver = (context: WidgetContext, section?: 'returns') =>
  salesReportLink(
    context.storeId,
    context.period ?? { from: context.today, to: context.today },
    section ? { section } : {},
  )

const KPI_WIDGETS: readonly WidgetDefinition[] = [
  kpiWidget({
    widget: 'kpi-sales-total',
    titleKey: 'homeWidgets.kpiSalesTotal',
    hintKey: 'homeWidgets.kpiSalesTotalHint',
    icon: <BanknoteIcon />,
    spec: { metric: 'sales_total', money: true, goodWhenUp: true, link: salesOver },
  }),
  kpiWidget({
    widget: 'kpi-orders',
    titleKey: 'homeWidgets.kpiOrders',
    hintKey: 'homeWidgets.kpiOrdersHint',
    icon: <ReceiptTextIcon />,
    spec: { metric: 'orders', money: false, goodWhenUp: true, link: salesOver },
  }),
  kpiWidget({
    widget: 'kpi-net-sales',
    titleKey: 'homeWidgets.kpiNetSales',
    hintKey: 'homeWidgets.kpiNetSalesHint',
    icon: <TrendingUpIcon />,
    spec: { metric: 'net_sales', money: true, goodWhenUp: true, link: salesOver },
  }),
  kpiWidget({
    widget: 'kpi-returns',
    titleKey: 'homeWidgets.kpiReturns',
    hintKey: 'homeWidgets.kpiReturnsHint',
    icon: <Undo2Icon />,
    spec: {
      metric: 'returns_total',
      money: true,
      goodWhenUp: false,
      link: (context) => salesOver(context, 'returns'),
    },
  }),
  kpiWidget({
    widget: 'kpi-offline',
    titleKey: 'homeWidgets.kpiOffline',
    hintKey: 'homeWidgets.kpiOfflineHint',
    icon: <PlugIcon />,
    spec: { metric: 'offline_orders', money: false, goodWhenUp: false, link: salesOver },
  }),
]

const CHART_WIDGETS: readonly WidgetDefinition[] = [
  {
    widget: 'sales-trend',
    titleKey: 'homeWidgets.trend',
    hintKey: 'homeWidgets.trendHint',
    icon: <TrendingUpIcon />,
    size: { w: 8, h: 7, minW: 5, minH: 5, maxW: 8, maxH: 8 },
    visible: canReadReports,
    usesOverview: true,
    render: (props) => <TrendWidget {...props} />,
  },
  {
    widget: 'top-items',
    titleKey: 'homeWidgets.topItems',
    hintKey: 'homeWidgets.topItemsHint',
    icon: <ChartColumnIcon />,
    size: { w: 4, h: 7, minW: 4, minH: 6, maxW: 7, maxH: 8 },
    visible: canReadReports,
    usesOverview: true,
    render: (props) => <TopItemsWidget {...props} />,
  },
  {
    widget: 'sales-by-hour',
    titleKey: 'homeWidgets.byHour',
    hintKey: 'homeWidgets.byHourHint',
    icon: <ClockIcon />,
    size: { w: 6, h: 5, minW: 4, minH: 4, maxW: 12, maxH: 8 },
    visible: canReadReports,
    usesOverview: true,
    render: (props) => <HourlyWidget {...props} />,
  },
  {
    widget: 'sales-by-source',
    titleKey: 'homeWidgets.bySource',
    hintKey: 'homeWidgets.bySourceHint',
    icon: <StoreIcon />,
    size: { w: 6, h: 5, minW: 3, minH: 4, maxW: 8, maxH: 8 },
    visible: canReadReports,
    usesOverview: true,
    render: (props) => <SourceWidget {...props} />,
  },
  {
    widget: 'order-status',
    titleKey: 'homeWidgets.byStatus',
    hintKey: 'homeWidgets.byStatusHint',
    icon: <ListChecksIcon />,
    size: { w: 4, h: 5, minW: 3, minH: 4, maxW: 6, maxH: 7 },
    visible: canReadReports,
    usesOverview: true,
    render: (props) => <StatusWidget {...props} />,
  },
  {
    widget: 'sales-by-day',
    titleKey: 'homeWidgets.byDay',
    hintKey: 'homeWidgets.byDayHint',
    icon: <TableIcon />,
    size: { w: 8, h: 6, minW: 5, minH: 4, maxW: 12, maxH: 10 },
    visible: canReadReports,
    usesOverview: true,
    render: (props) => <DailyTableWidget {...props} />,
  },
  {
    widget: 'stock-alerts',
    titleKey: 'homeWidgets.stockAlerts',
    hintKey: 'homeWidgets.stockAlertsHint',
    icon: <PackageXIcon />,
    size: { w: 6, h: 6, minW: 3, minH: 3, maxW: 8, maxH: 8 },
    // Its counts come with the sales overview, so report readers only.
    visible: (access) => canReadReports(access) && visibleNav('stock-alerts', access),
    usesOverview: true,
    unavailable: (overview) => overview.stock_alerts === null,
    render: (props) => <StockAlertsWidget {...props} />,
  },
]

const ATTENTION_WIDGETS: readonly WidgetDefinition[] = [
  attentionWidget({
    widget: 'attention-funds',
    titleKey: 'fundsAttentionTitle',
    hintKey: 'attention.fundsHint',
    icon: <BanknoteIcon />,
    to: '/funds/attention',
    visible: has('pos.payment.resolve'),
    useCount: (context) => useFundsAttention(context.branchId, true),
  }),
  attentionWidget({
    widget: 'attention-credit',
    titleKey: 'creditApprovalsTitle',
    hintKey: 'attention.creditHint',
    icon: <HandCoinsIcon />,
    to: '/credit-approvals',
    visible: (access) =>
      hasCapability(access, 'pos.approval.grant') && hasCapability(access, 'pos.credit.manage'),
    useCount: (context) => useCreditRequestsAttention(context.branchId, true),
  }),
  attentionWidget({
    widget: 'attention-cash',
    titleKey: 'cashRequestsTitle',
    hintKey: 'attention.cashHint',
    icon: <ArrowLeftRightIcon />,
    to: '/shifts',
    visible: (access) =>
      hasCapability(access, 'pos.cash.move') || hasCapability(access, 'pos.approval.grant'),
    useCount: (context) => useCashRequestsAttention(context.branchId, context.staffId, true),
  }),
  attentionWidget({
    widget: 'attention-shifts',
    titleKey: 'attention.openShifts',
    hintKey: 'attention.openShiftsHint',
    icon: <ClockIcon />,
    to: '/shifts',
    visible: has('pos.topology.recover'),
    useCount: (context) => useOpenShiftsAttention(context.branchId, context.shiftId, true),
  }),
  attentionWidget({
    widget: 'attention-deliveries',
    titleKey: 'attention.deliveries',
    hintKey: 'attention.deliveriesHint',
    icon: <TruckIcon />,
    to: '/deliveries',
    visible: (access) => canHandleDeliveries(access.context?.capabilities),
    useCount: (context) => usePendingDeliveryCount(context.branchId, true),
  }),
  attentionWidget({
    widget: 'attention-refunds',
    titleKey: 'ordersStatus_refund_pending',
    hintKey: 'attention.refundsHint',
    icon: <RotateCcwIcon />,
    to: '/orders?status=refund_pending',
    visible: canReadOrders,
    useCount: (context) => useRefundPendingCount(context.branchId, true),
  }),
]

export const HOME_WIDGETS: readonly WidgetDefinition[] = [
  ...KPI_WIDGETS,
  ...CHART_WIDGETS,
  ...ATTENTION_WIDGETS,
]

// The layout a reader starts from: the sales headline row, the trend beside
// the best sellers, then what waits to be handled. The other widgets are
// offered by "add widget".
export const HOME_DEFAULT_WIDGETS: readonly string[] = [
  'kpi-sales-total',
  'kpi-orders',
  'kpi-net-sales',
  'kpi-returns',
  'sales-trend',
  'top-items',
  ...ATTENTION_WIDGETS.map((definition) => definition.widget),
]

export const HOME_WIDGET_SIZES: WidgetSizes = Object.fromEntries(
  HOME_WIDGETS.map((definition) => [definition.widget, definition.size]),
)

const byWidget = new Map(HOME_WIDGETS.map((definition) => [definition.widget, definition]))
export const homeWidget = (widget: string) => byWidget.get(widget)
