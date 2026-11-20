import { describeFailure } from '@parkviet/pos-shared/request-failure'
import {
  adminClient,
  defineTable,
  filtersToRansack,
  getTable,
  PageHeader,
  ResourceTable,
  resourceSearchSchema,
  usePermissions,
} from '@spree/dashboard-core'
import {
  Badge,
  Button,
  ResourceNameCell,
  RowActions,
  StatusBadge,
  useConfirm,
  useRowClickBridge,
} from '@spree/dashboard-ui'
import {
  ArchiveIcon,
  BoxesIcon,
  DownloadIcon,
  PlusIcon,
  RotateCcwIcon,
} from '@spree/dashboard-ui/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import {
  defaultUnit,
  GoodsIngredientSheet,
  type IngredientEditor,
  type StockLocationField,
} from '../components/goods-ingredient-sheet'
import { PageSkeleton } from '../components/page-skeleton'
import { ModelState } from '../components/setup/model-ui'
import { goodsKey, useGoodsProductTypes, useGoodsWrite } from '../hooks/use-goods'
import { readIngredients } from '../hooks/use-goods-ingredients'
import { useGoodsUnits } from '../hooks/use-goods-products'
import { useGoodsSetup } from '../hooks/use-goods-setup'
import { usePosSession } from '../hooks/use-pos-session'
import type { StockAlert } from '../hooks/use-recipes'
import { useSession } from '../hooks/use-session'
import {
  BUSINESS_STATES,
  emptyIngredient,
  INGREDIENT_COLUMNS,
  type IngredientCellContext,
  type IngredientColumn,
  type IngredientRow,
  ingredientCells,
  ingredientForm,
  ingredientRow,
  STOCK_STATES,
} from '../lib/goods-ingredients'
import { downloadCsv, toCsv } from '../lib/goods-products'
import {
  canManageRecipes,
  canReadProductTypes,
  canReadStockAlerts,
  canWriteGoods,
  type PosAccess,
  runsRecipes,
} from '../lib/pos-access'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { localList } from '../tables/local-list'

const TABLE_KEY = 'pos-goods-ingredients'
const ROW_ATTRIBUTE = 'data-pos-ingredient-id' as const
type Notice = { text: string; failed: boolean }

const readStockAlerts = async (branchId: string) =>
  (
    await posRequest<{ data: StockAlert[] }>('GET', '/pos/stock_alerts', {
      params: { branch_id: branchId },
    })
  ).data

// "Nguyên liệu": products of the ingredient type, never published on the
// `pos` channel, with their stock and low-stock threshold at the selected
// branch. Ingredients are few, so the whole list is read and searched,
// filtered and paged here.
export function GoodsIngredientsPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const client = useQueryClient()
  const { storeId } = useSession()
  const { context, selection } = usePosSession()
  const { permissionKeys } = usePermissions()
  const access: PosAccess = { permissionKeys, context: context.data }
  const canWrite = canWriteGoods(access)
  const typesReadable = canReadProductTypes(access)
  const alertsReadable = runsRecipes(access) && canReadStockAlerts(access)
  const alertsWritable = runsRecipes(access) && canManageRecipes(access)
  const searchParams = resourceSearchSchema.parse(useSearch({ strict: false }))
  const currency = context.data?.store.currency ?? 'VND'
  const setup = useGoodsSetup()
  const types = useGoodsProductTypes(typesReadable)
  const units = useGoodsUnits(canWrite)
  const write = useGoodsWrite(async (run: () => Promise<unknown>) => run())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [editor, setEditor] = useState<IngredientEditor | null>(null)
  const [exporting, setExporting] = useState(false)
  const rows = useRef<IngredientRow[]>([])

  const branches = useMemo(
    () => (context.data?.branches ?? []).filter((branch) => branch.status === 'active'),
    [context.data],
  )
  const branchId = selection.branchId
  const branch = branches.find((row) => row.id === branchId) ?? null
  const locationId = branch?.stock_location_id ?? null
  const typeId = types.data?.byKind.ingredient?.id ?? null
  const locations = useMemo<StockLocationField[]>(() => {
    const names = new Map<string, string[]>()
    for (const row of branches)
      names.set(row.stock_location_id, [...(names.get(row.stock_location_id) ?? []), row.name])
    return [...names].map(([id, labels]) => ({ id, label: labels.join(', ') }))
  }, [branches])

  const cellContext: IngredientCellContext = {
    currency,
    stockLabel: (state) => t(`goods.ingredients.stock.${state}`),
    businessLabel: (state) => t(`goods.ingredients.business.${state}`),
    noAlert: t('goods.ingredients.noAlert'),
  }

  // The branch's rows: stock at its selling location and its thresholds.
  async function readRows() {
    const [products, alerts] = await Promise.all([
      client.fetchQuery({
        queryKey: goodsKey(storeId, 'ingredients', typeId),
        queryFn: () => (typeId ? readIngredients(typeId) : Promise.resolve([])),
      }),
      alertsReadable && branchId
        ? client.fetchQuery({
            queryKey: posKey(storeId, 'stock-alerts', branchId),
            queryFn: () => readStockAlerts(branchId),
          })
        : Promise.resolve([] as StockAlert[]),
    ])
    const thresholds = new Map(alerts.map((alert) => [alert.variant_id, alert.min_quantity]))
    rows.current = products.map((product) =>
      ingredientRow(product, {
        locationId,
        unitOf: () =>
          product.unit ? { code: product.unit.sale_unit, name: product.unit.sale_unit_name } : null,
        alertOf: (variantId) => thresholds.get(variantId) ?? null,
      }),
    )
    return rows.current
  }
  const listed = (all: IngredientRow[], params: Record<string, unknown>) =>
    localList(all, params, {
      searchParam: 'search',
      text: (row) => `${row.name} ${row.sku}`,
    })

  async function act(run: () => Promise<unknown>, success: string, failure?: string) {
    setNotice(null)
    try {
      await write.mutateAsync(run)
      setNotice({ text: success, failed: false })
    } catch (error) {
      const reason = describeFailure(error, t)
      setNotice({ text: failure ? `${failure} ${reason}` : reason, failed: true })
    }
  }
  async function toggle(row: IngredientRow) {
    const stopping = row.business === 'active'
    if (
      stopping &&
      !(await confirm({
        message: t('goods.ingredients.stopConfirm', { name: row.name }),
        variant: 'destructive',
        confirmLabel: t('goods.ingredients.stop'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    await act(
      () =>
        stopping ? adminClient.products.archive(row.id) : adminClient.products.activate(row.id),
      t(stopping ? 'goods.ingredients.stopped' : 'goods.ingredients.resumed', { name: row.name }),
    )
  }
  async function remove(row: IngredientRow) {
    if (
      !(await confirm({
        message: t('goods.ingredients.deleteConfirm', { name: row.name }),
        variant: 'destructive',
        confirmLabel: t('goods.ingredients.delete'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    await act(
      () => adminClient.products.delete(row.id),
      t('goods.ingredients.deleted', { name: row.name }),
      t('goods.ingredients.deleteFailed', { name: row.name }),
    )
  }
  function edit(row?: IngredientRow) {
    setNotice(null)
    setEditor(
      row
        ? {
            initial: ingredientForm(row),
            existing: {
              productId: row.id,
              variantId: row.variant_id,
              unitCode: row.unit_code,
              alert: row.alert,
            },
          }
        : { initial: emptyIngredient(defaultUnit(units.data ?? [])) },
    )
  }
  const openIngredient = useRef<(id: string) => void>(() => {})
  openIngredient.current = (id) => {
    const row = rows.current.find((item) => item.id === id)
    if (row && canWrite) edit(row)
  }
  const openRow = useCallback((id: string) => openIngredient.current(id), [])
  useRowClickBridge(ROW_ATTRIBUTE, openRow)

  defineTable<IngredientRow>(TABLE_KEY, {
    searchParam: 'search',
    searchPlaceholder: t('goods.ingredients.searchPlaceholder'),
    defaultSort: { field: 'name', direction: 'asc' },
    emptyIcon: <BoxesIcon className="size-8 text-muted-foreground" />,
    emptyMessage: t('goods.ingredients.empty'),
    columns: [
      {
        key: 'sku',
        label: t('goods.ingredients.columns.sku'),
        sortable: true,
        default: true,
        className: 'text-muted-foreground',
        render: (row) => ingredientCells(row, cellContext).sku,
      },
      {
        key: 'name',
        label: t('goods.ingredients.columns.name'),
        sortable: true,
        default: true,
        render: (row) => (
          <ResourceNameCell
            id={row.id}
            dataAttr={canWrite ? ROW_ATTRIBUTE : undefined}
            name={row.name}
          />
        ),
      },
      {
        key: 'unit',
        label: t('goods.ingredients.columns.unit'),
        default: true,
        render: (row) => ingredientCells(row, cellContext).unit,
      },
      {
        key: 'cost_price',
        label: t('goods.ingredients.columns.cost_price'),
        default: true,
        className: 'text-right tabular-nums whitespace-nowrap',
        render: (row) => ingredientCells(row, cellContext).cost_price,
      },
      {
        key: 'on_hand',
        label: t('goods.ingredients.columns.on_hand'),
        labelHint: t('goods.ingredients.onHandHint'),
        default: true,
        className: 'text-right tabular-nums',
        render: (row) => (
          <span
            className={row.negative ? 'font-medium text-destructive' : undefined}
            data-negative={row.negative || undefined}
          >
            {row.on_hand}
          </span>
        ),
      },
      {
        key: 'value',
        label: t('goods.ingredients.columns.value'),
        default: true,
        className: 'text-right tabular-nums whitespace-nowrap',
        render: (row) => ingredientCells(row, cellContext).value,
      },
      {
        key: 'stock_state',
        label: t('goods.ingredients.columns.stock_state'),
        filterable: true,
        default: true,
        filterType: 'enum',
        quickFilter: true,
        filterOptions: STOCK_STATES.map((value) => ({
          value,
          label: t(`goods.ingredients.stock.${value}`),
        })),
        render: (row) => (
          <span className="flex flex-col items-start gap-1">
            <Badge
              variant={
                row.stock_state === 'out'
                  ? 'destructive'
                  : row.stock_state === 'low'
                    ? 'secondary'
                    : 'outline'
              }
            >
              {t(`goods.ingredients.stock.${row.stock_state}`)}
            </Badge>
            {row.negative && (
              <span className="text-xs text-destructive">
                {t('goods.ingredients.negativeHint')}
              </span>
            )}
          </span>
        ),
      },
      ...(alertsReadable
        ? [
            {
              key: 'alert',
              label: t('goods.ingredients.columns.alert'),
              default: true,
              className: 'text-right tabular-nums',
              render: (row: IngredientRow) =>
                row.alert === null ? (
                  <span className="text-muted-foreground">{cellContext.noAlert}</span>
                ) : (
                  row.alert
                ),
            },
          ]
        : []),
      {
        key: 'business',
        label: t('goods.ingredients.columns.business'),
        filterable: true,
        default: true,
        filterType: 'enum',
        quickFilter: true,
        filterOptions: BUSINESS_STATES.map((value) => ({
          value,
          label: t(`goods.ingredients.business.${value}`),
        })),
        render: (row) => (
          <StatusBadge
            status={row.business === 'active' ? 'active' : 'archived'}
            label={t(`goods.ingredients.business.${row.business}`)}
          />
        ),
      },
    ],
  })

  // The rows the table shows now, every page of them, with the columns on.
  async function exportCsv() {
    setNotice(null)
    setExporting(true)
    try {
      const all = await readRows()
      const shown = listed(all, {
        ...(searchParams.search ? { search: searchParams.search } : {}),
        ...filtersToRansack(searchParams.filters, getTable(TABLE_KEY).columns),
        sort: searchParams.sort
          ? `${searchParams.dir === 'desc' ? '-' : ''}${searchParams.sort}`
          : 'name',
        limit: Math.max(1, all.length),
      }).data
      const visible = searchParams.columns ?? defaultColumns()
      const columns = INGREDIENT_COLUMNS.filter(
        (key) => (key === 'name' || visible.includes(key)) && (key !== 'alert' || alertsReadable),
      )
      const header = columns.map((key) => t(`goods.ingredients.columns.${key}`))
      const body = shown.map((row) => {
        const text = ingredientCells(row, cellContext)
        return columns.map((key: IngredientColumn) => text[key])
      })
      downloadCsv(
        toCsv([header, ...body]),
        `nguyen-lieu-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      setNotice({ text: t('goods.ingredients.exported', { count: shown.length }), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    } finally {
      setExporting(false)
    }
  }

  const header = (
    <PageHeader
      title={t('goods.ingredients.title')}
      actions={
        <div className="flex items-center gap-2">
          <BranchPicker />
          <Button variant="outline" disabled={exporting} onClick={() => void exportCsv()}>
            <DownloadIcon className="size-4" />
            {t(exporting ? 'waiting' : 'goods.ingredients.export')}
          </Button>
          {canWrite ? (
            <Button disabled={!typesReadable || units.isPending} onClick={() => edit()}>
              <PlusIcon className="size-4" />
              {t('goods.ingredients.create')}
            </Button>
          ) : (
            <Badge variant="outline">{t('adminReadAccess')}</Badge>
          )}
        </div>
      }
    />
  )
  if (!typesReadable)
    return (
      <div className="space-y-6">
        {header}
        <ModelState title={t('goods.ingredients.typesUnreadable')} error />
      </div>
    )
  if (types.isPending || context.isPending) return <PageSkeleton variant="page" />
  if (types.isError)
    return (
      <div className="space-y-6">
        {header}
        <ModelState
          title={describeFailure(types.error, t)}
          error
          retry={() => void types.refetch()}
        />
      </div>
    )

  return (
    <div className="space-y-6">
      {header}
      {notice && (
        <p
          role={notice.failed ? 'alert' : 'status'}
          className={notice.failed ? 'text-destructive' : 'text-muted-foreground'}
        >
          {notice.text}
        </p>
      )}
      <ResourceTable<IngredientRow>
        tableKey={TABLE_KEY}
        hideHeader
        queryKey={['pos', storeId, 'goods', 'ingredients-table', typeId, branchId, alertsReadable]}
        queryFn={async (params: Record<string, unknown>) => listed(await readRows(), params)}
        searchParams={searchParams}
        rowActions={(row) => (
          <RowActions
            actions={[
              {
                key: 'edit',
                label: t('adminEdit'),
                visible: canWrite,
                onSelect: () => edit(row),
              },
              {
                key: row.business === 'active' ? 'stop' : 'resume',
                label: t(
                  row.business === 'active' ? 'goods.ingredients.stop' : 'goods.ingredients.resume',
                ),
                icon:
                  row.business === 'active' ? (
                    <ArchiveIcon className="size-4" />
                  ) : (
                    <RotateCcwIcon className="size-4" />
                  ),
                visible: canWrite,
                destructive: row.business === 'active',
                disabled: write.isPending,
                onSelect: () => void toggle(row),
              },
              {
                key: 'delete',
                label: t('goods.ingredients.delete'),
                visible: canWrite,
                destructive: true,
                disabled: write.isPending,
                onSelect: () => void remove(row),
              },
            ]}
          />
        )}
      />
      {editor && canWrite && (
        <GoodsIngredientSheet
          editor={editor}
          units={units.data ?? []}
          locations={locations}
          alertBranch={alertsWritable && branch ? { id: branch.id, name: branch.name } : null}
          saveContext={{
            currency,
            ensureProductTypes: setup.ensureProductTypes,
            locationIds: locations.map((location) => location.id),
          }}
          onSaved={(name) =>
            setNotice({ text: t('goods.ingredients.saved', { name }), failed: false })
          }
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}

const defaultColumns = () =>
  getTable(TABLE_KEY)
    .columns.filter((column) => column.default)
    .map((column) => column.key)
