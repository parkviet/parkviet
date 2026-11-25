import { shortDate } from '@shared/debt-reminder'
import {
  DEBTOR_SORTS,
  type DebtorSort,
  downloadCsv,
  matchesReminderFilter,
  REMINDER_FILTERS,
  type ReminderFilter,
  sortDebtors,
} from '@shared/finance'
import { formatMoney } from '@shared/money'
import { formatDueDate } from '@shared/receivables'
import { describeFailure } from '@shared/request-failure'
import type { PosReceivable, PosReceivableAccount } from '@shared/types/pos-context'
import { defineTable, PageHeader, ResourceTable } from '@spree/dashboard-core'
import { Badge, Button, ResourceNameCell, RowActions, useRowClickBridge } from '@spree/dashboard-ui'
import { DownloadIcon, HandCoinsIcon, RotateCcwIcon } from '@spree/dashboard-ui/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import { DebtorSheet, DueBadge, OverdueBadge } from '../components/debtor-sheet'
import { FilterSelect } from '../components/filter-select'
import { PillTabs } from '../components/pill-tabs'
import { ModelCard } from '../components/setup/model-ui'
import {
  debtorList,
  fetchReceivables,
  RECEIVABLE_STATUSES,
  type ReceivableAccounts,
  type ReceivableStatus,
  receivableAccountsQuery,
  useReceivableAccounts,
} from '../hooks/use-debts'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import { branchTimeZone, formatInstant } from '../lib/format-time'
import { receivableSearchSchema } from '../schemas/list-search'
import { hiddenTimestamps } from '../tables/columns'

const AGING = ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_over_90'] as const
type View = 'customers' | 'orders' | 'settled'

// "Công nợ phải thu": who owes the selected branch, their orders, and
// settled customers, with aging totals, promised payment dates, reminder
// filters and a per-customer running ledger.
export function ReceivablesPage({ view }: { view: View }) {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const branchId = context.data?.selection.branch_id ?? null
  const base = `/${storeId}/receivables`
  return (
    <div className="space-y-6">
      <PageHeader title={t('receivablesTitle')} actions={<BranchPicker />} />
      {branchId ? (
        <Receivables key={`${branchId}:${view}`} branchId={branchId} view={view} base={base} />
      ) : (
        <p className="text-muted-foreground">{t('pageChooseBranchHint')}</p>
      )}
    </div>
  )
}

function Receivables({ branchId, view, base }: { branchId: string; view: View; base: string }) {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = receivableSearchSchema.parse(useSearch({ strict: false }))
  const customerStatus = view === 'settled' ? 'settled' : 'open'
  const accounts = useReceivableAccounts(branchId, customerStatus)
  const currency = context.data?.store.currency ?? 'VND'
  const totals = accounts.data?.meta.totals
  const settledCount = accounts.data?.meta.settled_count
  const tabs = [
    { key: 'customers', label: t('receivablesCustomers'), to: base },
    { key: 'orders', label: t('receivablesOrders'), to: `${base}/orders` },
    {
      key: 'settled',
      label:
        settledCount != null && settledCount > 0
          ? `${t('receivablesSettledTab')} (${settledCount})`
          : t('receivablesSettledTab'),
      to: `${base}/settled`,
    },
  ]
  const open = useCallback(
    (id: string) =>
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({ ...previous, accountId: id }),
      }),
    [navigate],
  )
  useRowClickBridge('data-pos-debtor-id', open)
  const selected = accounts.data?.data.find((row) => row.credit_account_id === search.accountId)
  const refresh = (
    <Button
      variant="outline"
      onClick={() => void client.invalidateQueries({ queryKey: ['pos', storeId, 'receivables'] })}
    >
      <RotateCcwIcon className="size-4" />
      {t('refresh')}
    </Button>
  )
  return (
    <>
      {accounts.isError ? (
        <div role="alert" className="space-y-2">
          <p>{describeFailure(accounts.error, t)}</p>
          <Button variant="outline" onClick={() => void accounts.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : totals ? (
        <ModelCard
          title={`${t('receivablesTotal')}: ${formatMoney(totals.balance, currency)} · ${t('receivablesOverdue')}: ${formatMoney(totals.overdue, currency)}`}
          id="receivables-aging"
          icon={<HandCoinsIcon />}
        >
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label={t('receivablesAging')}>
            {AGING.map((bucket) => (
              <div key={bucket}>
                <dt className="text-sm text-muted-foreground">{t(`aging_${bucket}`)}</dt>
                <dd className="font-medium tabular-nums">
                  {formatMoney(totals[bucket], currency)}
                </dd>
              </div>
            ))}
          </dl>
        </ModelCard>
      ) : null}
      <PillTabs tabs={tabs} />
      {view === 'customers' ? (
        <DebtorsTable
          branchId={branchId}
          accounts={accounts.data}
          actions={refresh}
          open={open}
          settled={false}
        />
      ) : view === 'settled' ? (
        <DebtorsTable
          branchId={branchId}
          accounts={accounts.data}
          actions={refresh}
          open={open}
          settled
        />
      ) : (
        <DebtsTable branchId={branchId} actions={refresh} />
      )}
      {search.accountId && (
        <DebtorSheet
          key={search.accountId}
          branchId={branchId}
          account={selected ?? null}
          loading={accounts.isPending}
          onClose={() =>
            void navigate({
              to: '.',
              search: (previous: Record<string, unknown>) => ({
                ...previous,
                accountId: undefined,
              }),
            })
          }
        />
      )}
    </>
  )
}

function PromisedBadge({ date, todayIso }: { date?: string | null; todayIso: string }) {
  const { t } = useTranslation()
  if (!date) return <span className="text-muted-foreground">—</span>
  if (date < todayIso) {
    return (
      <Badge variant="warning">
        {t('receivablesPromisedOverdue')} · {formatDueDate(date)}
      </Badge>
    )
  }
  if (date === todayIso) {
    return <Badge variant="secondary">{t('receivablesPromisedToday')}</Badge>
  }
  return <span className="whitespace-nowrap">{formatDueDate(date)}</span>
}

function DebtorsTable({
  branchId,
  accounts,
  actions,
  open,
  settled,
}: {
  branchId: string
  accounts: ReceivableAccounts | undefined
  actions: React.ReactNode
  open: (id: string) => void
  settled: boolean
}) {
  const { t, i18n } = useTranslation()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const client = useQueryClient()
  const navigate = useNavigate()
  const search = receivableSearchSchema.parse(useSearch({ strict: false }))
  const timeZone = branchTimeZone(context.data)
  const todayIso = new Date().toISOString().slice(0, 10)
  const reminderFilter: ReminderFilter = search.reminder ?? 'all'
  const sortKey: DebtorSort = search.sort ?? 'overdue'
  const tableKey = settled ? 'pos-debtors-settled' : 'pos-debtors'

  const patchSearch = (patch: Record<string, unknown>) =>
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch, page: undefined }),
    })

  const exportCsv = () => {
    const rows = accounts?.data ?? []
    downloadCsv(
      `cong-no-${settled ? 'da-tat-toan' : 'dang-no'}-${todayIso}.csv`,
      [
        t('receivablesCustomers'),
        t('customerPhone'),
        t('receivablesBalance'),
        t('receivablesOverdue'),
        t('receivablesPromisedPayOn'),
        t('debtorsLastRemindedLabel'),
      ],
      rows.map((acc) => [
        acc.customer.name,
        acc.customer.phone ?? '',
        acc.balance,
        acc.overdue,
        acc.promised_pay_on ?? '',
        acc.last_reminded_at ? formatInstant(acc.last_reminded_at, i18n.language, timeZone) : '',
      ]),
    )
  }

  defineTable<PosReceivableAccount>(tableKey, {
    searchParam: 'search',
    searchPlaceholder: t('debtorsSearch'),
    emptyMessage: t(
      settled
        ? 'receivablesSettledEmpty'
        : accounts && accounts.data.length > 0
          ? 'debtorsNoMatch'
          : 'receivablesEmpty',
    ),
    columns: [
      {
        key: 'customer',
        label: t('receivablesCustomers'),
        default: true,
        sortable: false,
        render: (account) => (
          <ResourceNameCell
            id={account.credit_account_id}
            dataAttr="data-pos-debtor-id"
            name={account.customer.name}
            secondary={[
              account.customer.phone,
              t('receivablesOrderCount', { count: account.orders }),
              !settled && account.oldest_placed_at
                ? t('debtorsSince', {
                    date: shortDate(account.oldest_placed_at),
                    count: account.days_owed ?? 0,
                  })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        ),
      },
      settled
        ? {
            key: 'status',
            label: t('receivablesStatus'),
            default: true,
            sortable: false,
            render: () => <Badge variant="secondary">{t('receivablesSettledBadge')}</Badge>,
          }
        : {
            key: 'overdue',
            label: t('receivablesOverdue'),
            default: true,
            sortable: false,
            render: (account) => <OverdueBadge account={account} />,
          },
      ...(!settled
        ? [
            {
              key: 'promised_pay_on',
              label: t('receivablesPromisedPayOn'),
              default: true,
              sortable: false,
              render: (account: PosReceivableAccount) => (
                <PromisedBadge date={account.promised_pay_on} todayIso={todayIso} />
              ),
            },
          ]
        : []),
      {
        key: 'last_reminded_at',
        label: t('debtorsLastRemindedLabel'),
        default: true,
        sortable: false,
        className: 'whitespace-nowrap',
        render: (account) =>
          account.last_reminded_at
            ? formatInstant(account.last_reminded_at, i18n.language, timeZone)
            : t('debtorsNeverReminded'),
      },
      {
        key: 'balance',
        label: t('receivablesBalance'),
        default: true,
        sortable: false,
        className: 'text-right tabular-nums',
        render: (account) => formatMoney(account.balance, account.currency),
      },
      ...hiddenTimestamps<PosReceivableAccount>(),
    ],
  })
  return (
    <ResourceTable<PosReceivableAccount>
      tableKey={tableKey}
      hideHeader
      queryKey={[
        'pos',
        'receivables',
        branchId,
        'accounts',
        settled ? 'settled' : 'open',
        reminderFilter,
        sortKey,
      ]}
      queryFn={async (params: Record<string, unknown>) => {
        const fetched = await client.fetchQuery(
          receivableAccountsQuery(storeId, branchId, settled ? 'settled' : 'open'),
        )
        const filtered = settled
          ? fetched.data
          : sortDebtors(
              fetched.data.filter((row) => matchesReminderFilter(row, reminderFilter, todayIso)),
              sortKey,
            )
        return debtorList({ ...fetched, data: filtered }, params)
      }}
      searchParams={search}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {!settled && (
            <>
              <FilterSelect
                label={t('receivablesReminderFilter')}
                value={reminderFilter}
                options={REMINDER_FILTERS.map((value) => ({
                  value,
                  label: t(`receivablesReminder_${value}`),
                }))}
                onChange={(value) => patchSearch({ reminder: value === 'all' ? undefined : value })}
              />
              <FilterSelect
                label={t('receivablesSortLabel')}
                value={sortKey}
                options={DEBTOR_SORTS.map((value) => ({
                  value,
                  label: t(`receivablesSort_${value}`),
                }))}
                onChange={(value) => patchSearch({ sort: value === 'overdue' ? undefined : value })}
              />
            </>
          )}
          <Button type="button" variant="outline" onClick={exportCsv}>
            <DownloadIcon className="size-4" />
            {t('financeExportCsv')}
          </Button>
          {actions}
        </div>
      }
      rowActions={(account) => (
        <RowActions
          actions={[
            {
              key: 'view',
              label: t('receivablesOpenCustomer'),
              onSelect: () => open(account.credit_account_id),
            },
          ]}
        />
      )}
    />
  )
}

function DebtsTable({ branchId, actions }: { branchId: string; actions: React.ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = receivableSearchSchema.parse(useSearch({ strict: false }))
  const status = search.status ?? 'open'
  const tableKey = 'pos-receivables'
  defineTable<PosReceivable>(tableKey, {
    searchParam: 'search',
    searchPlaceholder: t('receivablesSearch'),
    emptyMessage: t('receivablesEmpty'),
    columns: [
      {
        key: 'order_number',
        label: t('receivablesOrders'),
        default: true,
        sortable: false,
        render: (debt) => (
          <ResourceNameCell
            id={debt.order_id}
            name={debt.order_number}
            secondary={[debt.customer.name, debt.customer.phone].filter(Boolean).join(' · ')}
          />
        ),
      },
      {
        key: 'due_on',
        label: t('receivablesDue'),
        default: true,
        sortable: false,
        render: (debt) => <DueBadge debt={debt} />,
      },
      ...(
        [
          ['original_total', 'receivablesOriginal'],
          ['paid_at_sale', 'receivablesPaidAtSale'],
          ['collected', 'receivablesCollected'],
          ['balance', 'receivablesBalance'],
        ] as const
      ).map(([key, label]) => ({
        key,
        label: t(label),
        default: true,
        sortable: false,
        className: 'text-right tabular-nums',
        render: (debt: PosReceivable) => formatMoney(debt[key], debt.currency),
      })),
      ...hiddenTimestamps<PosReceivable>(),
    ],
  })
  return (
    <ResourceTable<PosReceivable>
      tableKey={tableKey}
      hideHeader
      queryKey={['pos', 'receivables', branchId, 'orders', status]}
      queryFn={async (params: Record<string, unknown>) => {
        // The server pages debts and has no text search: the search box
        // narrows the loaded page by order number or customer.
        const page = await fetchReceivables(branchId, { status }, params)
        const term = String(params.search ?? '')
          .trim()
          .toLocaleLowerCase()
        return term
          ? {
              ...page,
              data: page.data.filter((debt) =>
                [debt.order_number, debt.customer.name, debt.customer.phone]
                  .join(' ')
                  .toLocaleLowerCase()
                  .includes(term),
              ),
            }
          : page
      }}
      searchParams={search}
      actions={
        <>
          <FilterSelect
            label={t('receivablesStatus')}
            value={status}
            options={RECEIVABLE_STATUSES.map((value) => ({
              value,
              label: t(`receivablesStatus_${value}`),
            }))}
            onChange={(value) =>
              void navigate({
                to: '.',
                search: (previous: Record<string, unknown>) => ({
                  ...previous,
                  status: value as ReceivableStatus,
                  page: undefined,
                }),
              })
            }
          />
          {actions}
        </>
      }
      rowActions={(debt) => (
        <RowActions
          actions={[
            {
              key: 'customer',
              label: t('receivablesOpenCustomer'),
              onSelect: () =>
                void navigate({
                  to: '.',
                  search: (previous: Record<string, unknown>) => ({
                    ...previous,
                    accountId: debt.credit_account_id,
                  }),
                }),
            },
          ]}
        />
      )}
    />
  )
}
