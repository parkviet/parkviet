import { describeFailure } from '@parkviet/pos-shared/request-failure'
import { defineTable, PageHeader, ResourceTable, usePermissions } from '@spree/dashboard-core'
import {
  Badge,
  Button,
  ResourceNameCell,
  RowActions,
  SectionTitle,
  Tabs,
  TabsList,
  TabsTrigger,
  useConfirm,
  useRowClickBridge,
} from '@spree/dashboard-ui'
import { PauseIcon, PlayIcon, PlusIcon, TagsIcon } from '@spree/dashboard-ui/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MasterNotice } from '../components/master-page'
import { PageSkeleton } from '../components/page-skeleton'
import { ModelState } from '../components/setup/model-ui'
import { goodsKey, useGoodsWrite } from '../hooks/use-goods'
import {
  deletePriceList,
  readPriceListScreen,
  type ScreenEntry,
  setPriceListActive,
  usePriceListScreen,
} from '../hooks/use-goods-price-lists'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import {
  canPause,
  listChannels,
  listCode,
  PRICE_LIST_STATES,
  type PriceListState,
  type PricingMethod,
  priceListState,
  pricingMethodOf,
  stateCounts,
  zonedDay,
} from '../lib/goods-price-list-form'
import { canWriteGoods } from '../lib/pos-access'
import { goodsPriceListSearchSchema } from '../schemas/goods-price-list-search'
import { localList } from '../tables/local-list'

const TABLE_KEY = 'pos-goods-price-lists'
const ROW_ATTRIBUTE = 'data-pos-price-list-id' as const
type Notice = { text: string; failed: boolean } | null

export type PriceListRow = {
  id: string
  catalogId: string | null
  code: string
  name: string
  method: PricingMethod
  starts: string
  ends: string
  reach: string
  state: PriceListState
  pausable: boolean
}

const day = (value: string | null, timeZone: string) => {
  if (!value) return ''
  const [year, month, date] = zonedDay(value, timeZone).split('-')
  return `${date}/${month}/${year}`
}

// "Bảng giá": the store's Spree price lists that do not belong to someone
// else's catalog, counted by state, searched by code or name.
export function GoodsPriceListsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const client = useQueryClient()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const { permissionKeys } = usePermissions()
  const canWrite = canWriteGoods({ permissionKeys })
  const searchParams = goodsPriceListSearchSchema.parse(useSearch({ strict: false }))
  const tab = searchParams.state ?? 'all'
  const timeZone = context.data?.store.timezone || 'Asia/Ho_Chi_Minh'
  const screen = usePriceListScreen()
  const write = useGoodsWrite(async (run: () => Promise<unknown>) => run())
  const [notice, setNotice] = useState<Notice>(null)
  const rows = useRef<PriceListRow[]>([])

  const toRow = (entry: ScreenEntry, now: Date): PriceListRow => {
    const channels = listChannels(entry.list)
    return {
      id: entry.list.id,
      catalogId: entry.catalog?.id ?? null,
      code: listCode(entry.list),
      name: entry.list.name,
      method: pricingMethodOf(entry.list),
      starts: day(entry.list.starts_at, timeZone),
      ends: day(entry.list.ends_at, timeZone),
      reach: entry.catalog
        ? t('goods.priceLists.reachGroups', { groups: entry.catalog.groupNames.join(', ') || '—' })
        : channels.length > 0
          ? channels.map((channel) => channel.name).join(', ')
          : t('goods.priceLists.reachAll'),
      state: priceListState(entry.list, now),
      pausable: canPause(entry.list),
    }
  }

  async function act(run: () => Promise<unknown>, success: string) {
    setNotice(null)
    try {
      await write.mutateAsync(run)
      setNotice({ text: success, failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }
  async function toggle(row: PriceListRow) {
    if (
      row.pausable &&
      !(await confirm({
        message: t('goods.priceLists.pauseConfirm', { name: row.name }),
        variant: 'destructive',
        confirmLabel: t('goods.priceLists.pause'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    await act(
      () => setPriceListActive({ listId: row.id, active: !row.pausable }),
      t(row.pausable ? 'goods.priceLists.paused' : 'goods.priceLists.activated', {
        name: row.name,
      }),
    )
  }
  async function remove(row: PriceListRow) {
    if (
      !(await confirm({
        message: t('goods.priceLists.deleteConfirm', { name: row.name }),
        variant: 'destructive',
        confirmLabel: t('goods.priceLists.delete'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    await act(
      () => deletePriceList({ listId: row.id, catalogId: row.catalogId }),
      t('goods.priceLists.deleted', { name: row.name }),
    )
  }
  const open = (id: string) =>
    navigate({
      to: '/$storeId/goods/price-lists/$priceListId',
      params: { storeId, priceListId: id },
    })
  const openList = useRef<(id: string) => void>(() => {})
  openList.current = open
  const openRow = useCallback((id: string) => openList.current(id), [])
  useRowClickBridge(ROW_ATTRIBUTE, openRow)

  const setTab = (value: string) =>
    navigate({
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        page: undefined,
        state: value === 'all' ? undefined : value,
      })) as never,
    })

  defineTable<PriceListRow>(TABLE_KEY, {
    searchParam: 'search',
    searchPlaceholder: t('goods.priceLists.searchPlaceholder'),
    defaultSort: { field: 'name', direction: 'asc' },
    emptyIcon: <TagsIcon className="size-8 text-muted-foreground" />,
    emptyMessage: t('goods.priceLists.empty'),
    columns: [
      {
        key: 'code',
        label: t('goods.priceLists.columns.code'),
        sortable: true,
        default: true,
        className: 'text-muted-foreground',
        render: (row) => row.code || '—',
      },
      {
        key: 'name',
        label: t('goods.priceLists.columns.name'),
        sortable: true,
        default: true,
        render: (row) => <ResourceNameCell id={row.id} dataAttr={ROW_ATTRIBUTE} name={row.name} />,
      },
      {
        key: 'method',
        label: t('goods.priceLists.columns.method'),
        default: true,
        render: (row) => t(`goods.priceLists.method.${row.method}`),
      },
      {
        key: 'period',
        label: t('goods.priceLists.columns.period'),
        default: true,
        className: 'whitespace-nowrap tabular-nums',
        render: (row) =>
          `${row.starts || t('goods.priceLists.noStart')} – ${row.ends || t('goods.priceLists.noEnd')}`,
      },
      {
        key: 'reach',
        label: t('goods.priceLists.columns.reach'),
        default: true,
        render: (row) => row.reach,
      },
      {
        key: 'state',
        label: t('goods.priceLists.columns.state'),
        default: true,
        render: (row) => (
          <Badge
            variant={
              row.state === 'active' ? 'default' : row.state === 'expired' ? 'secondary' : 'outline'
            }
          >
            {t(`goods.priceLists.state.${row.state}`)}
          </Badge>
        ),
      },
    ],
  })

  const header = (
    <PageHeader
      title={t('goods.priceLists.title')}
      actions={
        canWrite ? (
          <Button
            onClick={() => navigate({ to: '/$storeId/goods/price-lists/new', params: { storeId } })}
          >
            <PlusIcon className="size-4" />
            {t('goods.priceLists.create')}
          </Button>
        ) : (
          <Badge variant="outline">{t('adminReadAccess')}</Badge>
        )
      }
    />
  )
  if (screen.isPending) return <PageSkeleton variant="page" />
  if (screen.isError)
    return (
      <div className="space-y-6">
        {header}
        <ModelState
          title={describeFailure(screen.error, t)}
          error
          retry={() => void screen.refetch()}
        />
      </div>
    )
  const counts = stateCounts(
    screen.data.map((entry) => entry.list),
    new Date(),
  )

  return (
    <div className="space-y-6">
      {header}
      <p className="text-base text-muted-foreground">{t('goods.priceLists.hint')}</p>
      <div className="w-full min-w-0 overflow-x-auto">
        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <TabsList aria-label={t('goods.priceLists.tabs')}>
            {(['all', ...PRICE_LIST_STATES] as const).map((key) => (
              <TabsTrigger key={key} value={key}>
                {t(key === 'all' ? 'goods.priceLists.state.all' : `goods.priceLists.state.${key}`)}
                <span className="tabular-nums text-muted-foreground">{counts[key]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <SectionTitle>
        <TagsIcon />
        {t('goods.priceLists.title')}
      </SectionTitle>
      <MasterNotice notice={notice} />
      <ResourceTable<PriceListRow>
        tableKey={TABLE_KEY}
        hideHeader
        queryKey={['pos', storeId, 'goods', 'price-lists-table', tab, timeZone]}
        queryFn={async (params: Record<string, unknown>) => {
          const entries = await client.fetchQuery({
            queryKey: goodsKey(storeId, 'price-list-screen'),
            queryFn: readPriceListScreen,
          })
          const now = new Date()
          rows.current = entries
            .map((entry) => toRow(entry, now))
            .filter((row) => tab === 'all' || row.state === tab)
          return localList(rows.current, params, {
            searchParam: 'search',
            text: (row) => `${row.code} ${row.name}`,
          })
        }}
        searchParams={searchParams}
        rowActions={(row) => (
          <RowActions
            actions={[
              {
                key: 'edit',
                label: t(canWrite ? 'adminEdit' : 'goods.priceLists.view'),
                onSelect: () => void open(row.id),
              },
              {
                key: row.pausable ? 'pause' : 'activate',
                label: t(row.pausable ? 'goods.priceLists.pause' : 'goods.priceLists.activate'),
                icon: row.pausable ? (
                  <PauseIcon className="size-4" />
                ) : (
                  <PlayIcon className="size-4" />
                ),
                visible: canWrite && row.state !== 'expired',
                destructive: row.pausable,
                disabled: write.isPending,
                onSelect: () => void toggle(row),
              },
              {
                key: 'delete',
                label: t('goods.priceLists.delete'),
                visible: canWrite,
                destructive: true,
                disabled: write.isPending,
                onSelect: () => void remove(row),
              },
            ]}
          />
        )}
      />
    </div>
  )
}
