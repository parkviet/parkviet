import { canHandleDeliveries } from '@parkviet/pos-shared/deliveries'
import { describeFailure } from '@parkviet/pos-shared/request-failure'
import { Badge, Button, Skeleton } from '@spree/dashboard-ui'
import {
  ArrowLeftRightIcon,
  BanknoteIcon,
  ClockIcon,
  HandCoinsIcon,
  RotateCcwIcon,
  TruckIcon,
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
import type { WidgetSize, WidgetSizes } from '../../lib/dashboard-layout'
import { canReadOrders, hasCapability, type PosAccess } from '../../lib/pos-access'
import { WidgetCard } from './widget-card'

// What a widget reads from the page: the selected branch and the reader.
export type WidgetContext = {
  storeId: string
  branchId: string
  staffId: string | null
  shiftId: string | null
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
  // The widget body; `titleId` names the widget's section.
  render: (props: WidgetProps) => ReactNode
}

export type WidgetProps = { context: WidgetContext; titleId: string }

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

export const HOME_WIDGETS: readonly WidgetDefinition[] = [
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

export const HOME_WIDGET_SIZES: WidgetSizes = Object.fromEntries(
  HOME_WIDGETS.map((definition) => [definition.widget, definition.size]),
)

const byWidget = new Map(HOME_WIDGETS.map((definition) => [definition.widget, definition]))
export const homeWidget = (widget: string) => byWidget.get(widget)
