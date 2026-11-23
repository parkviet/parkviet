import { describeFailure } from '@shared/request-failure'
import { PageHeader, usePermissions } from '@spree/dashboard-core'
import {
  Button,
  SearchInput,
  Tabs,
  TabsList,
  TabsTrigger,
  useDebouncedValue,
} from '@spree/dashboard-ui'
import { SettingsIcon } from '@spree/dashboard-ui/icons'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import { KitchenAllDay } from '../components/kitchen/kitchen-all-day'
import { KitchenColumn } from '../components/kitchen/kitchen-column'
import { KitchenTicketCard } from '../components/kitchen/kitchen-ticket-card'
import { KitchenToolbar } from '../components/kitchen/kitchen-toolbar'
import { KitchenVoidRequests } from '../components/kitchen/kitchen-void-requests'
import { useKitchenStations } from '../hooks/use-kitchen'
import {
  type KitchenAllDayRow,
  useBumpAllDay,
  useBumpTicket,
  useKitchenBoard,
  useKitchenItemAction,
  useSetPriority,
} from '../hooks/use-kitchen-board'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import {
  boardColumns,
  KITCHEN_COLUMNS,
  type KitchenColumnKey,
  lateness,
  normalizeText,
  priorityCount,
} from '../lib/kitchen-board'
import { canManageBranch, canManageKitchen, runsKitchen } from '../lib/pos-access'
import { type KitchenSearch, kitchenSearchSchema } from '../schemas/kitchen-search'

// The kitchen screen of one branch: the board of tickets by stage, and the
// requests to void dishes already sent. It acts on the branch the picker
// (or `?branch=`) selects, whoever may operate that branch's kitchen.
export function KitchenBoardPage() {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { permissionKeys } = usePermissions()
  const { context } = usePosSession()
  const navigate = useNavigate({ from: '/$storeId/kitchen' })
  const search = kitchenSearchSchema.parse(useSearch({ strict: false }))
  const branchId = context.data?.selection.branch_id ?? null
  const access = { permissionKeys, context: context.data }
  const tab = search.tab ?? 'board'

  const update = (patch: Partial<KitchenSearch>) =>
    void navigate({
      search: (previous) => {
        const next: Record<string, unknown> = { ...kitchenSearchSchema.parse(previous), ...patch }
        for (const key of Object.keys(next)) if (!next[key]) delete next[key]
        if (next.tab === 'board') delete next.tab
        // The branch picker's own keys ride along untouched.
        return { ...next, branch: previous.branch, register: previous.register }
      },
      replace: true,
    })

  const [term, setTerm] = useState(search.q ?? '')
  const debounced = useDebouncedValue(term, 300)
  // biome-ignore lint/correctness/useExhaustiveDependencies: write the debounced text once it settles
  useEffect(() => {
    const next = debounced.trim()
    if (next !== (search.q ?? '')) update({ q: next || undefined })
  }, [debounced])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('kitchenBoard.title')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'board' && branchId && (
              <SearchInput
                value={term}
                onValueChange={setTerm}
                placeholder={t('kitchenBoard.searchPlaceholder')}
                aria-label={t('kitchenBoard.searchPlaceholder')}
                clearLabel={t('adminClose')}
                className="h-[2.125rem] w-64"
              />
            )}
            <BranchPicker />
            {branchId && canManageKitchen(access) && (
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/$storeId/branches/$branchId/kitchen"
                  params={{ storeId, branchId }}
                  search={(previous) => ({
                    branch: previous.branch,
                    register: previous.register,
                  })}
                >
                  <SettingsIcon className="size-4" />
                  {t('kitchenBoard.settings')}
                </Link>
              </Button>
            )}
          </div>
        }
      />
      {!branchId ? (
        <p className="text-muted-foreground">{t('pageChooseBranchHint')}</p>
      ) : !runsKitchen(access) ? (
        <div role="status" className="space-y-2">
          <p className="text-muted-foreground">{t('kitchenBoard.moduleOff')}</p>
          {canManageBranch(access, branchId) && (
            <Button asChild variant="outline" size="sm">
              <Link
                to="/$storeId/branches/$branchId/features"
                params={{ storeId, branchId }}
                search={(previous) => ({
                  branch: previous.branch,
                  register: previous.register,
                })}
              >
                {t('kitchenBoard.enableModule')}
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Tabs
            value={tab}
            onValueChange={(value) => update({ tab: value === 'voids' ? 'voids' : 'board' })}
          >
            <TabsList>
              <TabsTrigger value="board">{t('kitchenBoard.tabBoard')}</TabsTrigger>
              <TabsTrigger value="voids">{t('kitchenBoard.tabVoids')}</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === 'voids' ? (
            <KitchenVoidRequests
              key={branchId}
              branchId={branchId}
              group={search.voidStatus ?? 'pending'}
              onGroup={(voidStatus) => update({ voidStatus })}
            />
          ) : (
            <KitchenBody key={branchId} branchId={branchId} search={search} update={update} />
          )}
        </div>
      )}
    </div>
  )
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

function KitchenBody({
  branchId,
  search,
  update,
}: {
  branchId: string
  search: KitchenSearch
  update: (patch: Partial<KitchenSearch>) => void
}) {
  const { t } = useTranslation()
  const now = useNow(1000)
  const stationList = useKitchenStations(branchId)
  const activeStations = useMemo(
    () => (stationList.data ?? []).filter((station) => station.active),
    [stationList.data],
  )
  const stationIds = useMemo(
    () =>
      (search.stations ?? '')
        .split(',')
        .filter((id) => activeStations.some((station) => station.id === id)),
    [search.stations, activeStations],
  )
  const priorityOnly = search.priority === true
  const showVoided = search.voided === true
  const view = search.view ?? 'tickets'
  const query = search.q ?? ''
  const board = useKitchenBoard(branchId, { stationIds, priorityOnly })
  const itemAction = useKitchenItemAction()
  const bumpTicket = useBumpTicket()
  const bumpAllDay = useBumpAllDay()
  const setPriority = useSetPriority()
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const [notice, setNotice] = useState<string | null>(null)
  const [mobileColumn, setMobileColumn] = useState<KitchenColumnKey>('waiting')

  const data = board.data
  const clock = { serverNow: data?.server_now ?? '', receivedAt: board.dataUpdatedAt }
  const columns = useMemo(
    () => (data ? boardColumns(data, { showVoided, query, priorityOnly }) : null),
    [data, showVoided, query, priorityOnly],
  )
  const stationById = useMemo(
    () => new Map((data?.stations ?? []).map((station) => [station.id, station])),
    [data?.stations],
  )
  const dishes = useMemo(() => {
    const needle = normalizeText(query)
    return (data?.all_day ?? []).filter(
      (row) => !needle || normalizeText(row.name).includes(needle),
    )
  }, [data?.all_day, query])

  // One command per card or dish at a time; a refusal (another device moved
  // it first) is shown and the board is read again by the mutation.
  async function perform(id: string, work: () => Promise<unknown>) {
    if (busy.has(id)) return
    setBusy((current) => new Set(current).add(id))
    setNotice(null)
    try {
      await work()
    } catch (failure) {
      setNotice(describeFailure(failure, t, 'kitchenBoard.actionFailed'))
    } finally {
      setBusy((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }
  const actions = {
    item: (item: { id: string }, action: 'start' | 'ready' | 'serve' | 'recall') =>
      void perform(item.id, () => itemAction.mutateAsync({ itemId: item.id, action })),
    bump: (card: { id: string }) => void perform(card.id, () => bumpTicket.mutateAsync(card.id)),
    priority: (target: 'item' | 'ticket', id: string, priority: boolean) =>
      void perform(id, () => setPriority.mutateAsync({ target, id, priority })),
  }
  const bumpDish = (row: KitchenAllDayRow) =>
    void perform(row.key, () => bumpAllDay.mutateAsync({ branchId, stationIds, key: row.key }))

  if (board.isError && !data)
    return (
      <div role="alert" className="flex items-center gap-3 text-destructive">
        {describeFailure(board.error, t, 'kitchenBoard.loadFailed')}
        <Button type="button" variant="outline" size="sm" onClick={() => void board.refetch()}>
          {t('retry')}
        </Button>
      </div>
    )
  if (!data || !columns)
    return (
      <p role="status" className="text-muted-foreground">
        {t('waiting')}
      </p>
    )

  return (
    <div className="space-y-4">
      <KitchenToolbar
        stations={activeStations}
        stationIds={stationIds}
        onStations={(ids) => update({ stations: ids.length > 0 ? ids.join(',') : undefined })}
        priorityOnly={priorityOnly}
        priorityCount={priorityCount(data)}
        onPriorityOnly={(value) => update({ priority: value || undefined })}
        view={view}
        onView={(next) => update({ view: next === 'tickets' ? undefined : next })}
        showVoided={showVoided}
        onShowVoided={(value) => update({ voided: value || undefined })}
      />
      {notice && (
        <p role="alert" className="text-destructive">
          {notice}
        </p>
      )}
      {board.isError && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('kitchenBoard.stale')}
        </p>
      )}
      {view === 'dishes' ? (
        <KitchenAllDay rows={dishes} clock={clock} now={now} busy={busy} onBump={bumpDish} />
      ) : (
        <>
          <Tabs
            className="md:hidden"
            value={mobileColumn}
            onValueChange={(value) => setMobileColumn(value as KitchenColumnKey)}
          >
            <TabsList>
              {KITCHEN_COLUMNS.map((key) => (
                <TabsTrigger key={key} value={key}>
                  {t(`kitchenBoard.column_${key}`)} ({columns[key].length})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="grid gap-4 md:grid-cols-3">
            {KITCHEN_COLUMNS.map((key) => (
              <KitchenColumn
                key={key}
                column={key}
                count={columns[key].length}
                active={mobileColumn === key}
              >
                {columns[key].map((card) => (
                  <KitchenTicketCard
                    key={`${key}-${card.id}`}
                    card={card}
                    column={key}
                    lateness={lateness(
                      card.sentAt,
                      card.stationId ? stationById.get(card.stationId) : null,
                      clock,
                      now,
                    )}
                    clock={clock}
                    now={now}
                    busy={busy}
                    actions={actions}
                  />
                ))}
              </KitchenColumn>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
