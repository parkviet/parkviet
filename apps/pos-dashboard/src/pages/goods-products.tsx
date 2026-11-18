import { describeFailure } from '@parkviet/pos-shared/request-failure'
import {
  adminClient,
  type BulkAction,
  type BulkActionFormProps,
  defineTable,
  filtersToRansack,
  getTable,
  ImportButton,
  ImportWizardDialog,
  PageHeader,
  type ResourceActionsContext,
  ResourceTable,
  Subject,
  usePermissions,
} from '@spree/dashboard-core'
import {
  Badge,
  BulkDialog,
  Button,
  ProductIdentity,
  RowActions,
  StatusBadge,
  useConfirm,
} from '@spree/dashboard-ui'
import {
  ArchiveIcon,
  DownloadIcon,
  FolderPlusIcon,
  PackageIcon,
  PlusIcon,
  RadioTowerIcon,
  RotateCcwIcon,
  TagIcon,
} from '@spree/dashboard-ui/icons'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CategoryChecklist } from '../components/goods-category-checklist'
import { TopologyField, TopologySelect } from '../components/topology-fields'
import {
  goodsKey,
  type ProductListParams,
  useGoodsCategories,
  useGoodsProductTypes,
  useGoodsTaxCategories,
  useGoodsWrite,
} from '../hooks/use-goods'
import {
  type GoodsListProduct,
  PRODUCT_EXPAND,
  readAllGoodsProducts,
  readGoodsProducts,
  useGoodsTaxRates,
} from '../hooks/use-goods-products'
import { POS_CHANNEL_CODE, useGoodsSetup } from '../hooks/use-goods-setup'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import {
  bulkDeleteOutcome,
  downloadCsv,
  GOODS_COLUMNS,
  type GoodsCellContext,
  type GoodsColumn,
  goodsCells,
  type ProductStock,
  productStock,
  toCsv,
} from '../lib/goods-products'
import { canReadProductTypes, canWriteGoods } from '../lib/pos-access'
import { goodsProductSearchSchema } from '../schemas/goods-product-search'

const TABLE_KEY = 'pos-goods-products'
const STATUSES = ['active', 'draft', 'archived'] as const
type Status = (typeof STATUSES)[number]
// The catalog not on the `pos` channel yet leaves out ingredients, which are
// never published there. A Ransack group keeps products without a type, which
// `product_type_id_not_eq` alone would drop.
const viewParams = (ingredientTypeId: string | null) => ({
  pos: { channels_code_eq: POS_CHANNEL_CODE },
  unpublished: {
    not_in_channel: POS_CHANNEL_CODE,
    ...(ingredientTypeId
      ? {
          'q[g][0][m]': 'or',
          'q[g][0][product_type_id_null]': '1',
          'q[g][0][product_type_id_not_eq]': ingredientTypeId,
        }
      : {}),
  },
})

// The store's products as the counter sells them: what is on the `pos`
// channel, with a second view of the catalog not on it yet. Paging,
// search and filters run on the server.
export function GoodsProductsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const { permissionKeys } = usePermissions()
  const canWrite = canWriteGoods({ permissionKeys })
  const setup = useGoodsSetup()
  const searchParams = goodsProductSearchSchema.parse(useSearch({ strict: false }))
  const view = searchParams.view ?? 'pos'
  const currency = context.data?.store.currency ?? 'VND'
  const types = useGoodsProductTypes(canReadProductTypes({ permissionKeys }))
  const viewQuery = viewParams(types.data?.byKind.ingredient?.id ?? null)
  const categories = useGoodsCategories()
  const taxCategories = useGoodsTaxCategories()
  const taxRates = useGoodsTaxRates()
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const [importId, setImportId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const write = useGoodsWrite(async (run: () => Promise<unknown>) => run())

  const cellContext = useMemo<Omit<GoodsCellContext, 'unitName'>>(() => {
    const rates = taxRates.data ?? []
    const taxNames = new Map((taxCategories.data ?? []).map((row) => [row.id, row.name]))
    const typeNames = new Map((types.data?.types ?? []).map((row) => [row.id, row.name]))
    return {
      currency,
      locationIds:
        context.data?.branches
          .filter((branch) => branch.status === 'active')
          .map((branch) => branch.stock_location_id) ?? null,
      taxLabel: (id) => {
        if (!id) return '—'
        const percents = rates
          .filter((rate) => rate.tax_category_id === id && rate.rate_percent)
          .map((rate) => `${rate.rate_percent}%`)
        const name = taxNames.get(id) ?? '—'
        return percents.length ? `${name} (${[...new Set(percents)].join(', ')})` : name
      },
      typeName: (id) => (id ? (typeNames.get(id) ?? '—') : '—'),
      statusLabel: (status) => t(`goods.products.status.${status}`, { defaultValue: status }),
      stockLabel: (stock: ProductStock) =>
        stock.tracked
          ? String(stock.onHand)
          : t(stock.inStock ? 'goods.products.inStock' : 'goods.products.outOfStock'),
    }
  }, [currency, context.data, taxRates.data, taxCategories.data, types.data, t])
  const cells = (product: GoodsListProduct) =>
    goodsCells(product, { ...cellContext, unitName: () => product.unit_name })

  async function act(run: () => Promise<unknown>, success: string) {
    setNotice(null)
    try {
      await write.mutateAsync(run)
      setNotice({ text: success, failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }
  async function clone(product: GoodsListProduct) {
    setNotice(null)
    try {
      const copy = (await write.mutateAsync(() => adminClient.products.clone(product.id))) as {
        id: string
      }
      navigate({
        to: '/$storeId/goods/products/$productId',
        params: { storeId, productId: copy.id },
      })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }
  async function toggleSale(product: GoodsListProduct) {
    const stopping = product.status === 'active'
    if (
      stopping &&
      !(await confirm({
        message: t('goods.products.stopConfirm', { name: product.name }),
        variant: 'destructive',
        confirmLabel: t('goods.products.stop'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    await act(
      () =>
        stopping
          ? adminClient.products.archive(product.id)
          : adminClient.products.activate(product.id),
      t(stopping ? 'goods.products.stopped' : 'goods.products.resumed', { name: product.name }),
    )
  }
  async function remove(product: GoodsListProduct) {
    if (
      !(await confirm({
        message: t('goods.products.deleteConfirm', { name: product.name }),
        variant: 'destructive',
        confirmLabel: t('goods.products.delete'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    await act(
      () => adminClient.products.delete(product.id),
      t('goods.products.deleted', { name: product.name }),
    )
  }

  const typeOptions = (types.data?.types ?? []).map((type) => ({
    value: type.id,
    label: type.name,
  }))
  const categoryOptions = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: category.pretty_name || category.name,
  }))
  defineTable<GoodsListProduct>(TABLE_KEY, {
    searchParam: 'search_with_barcode',
    searchPlaceholder: t('goods.products.searchPlaceholder'),
    defaultSort: { field: 'name', direction: 'asc' },
    emptyIcon: <PackageIcon className="size-8 text-muted-foreground" />,
    emptyMessage: t(view === 'pos' ? 'goods.products.emptyPos' : 'goods.products.emptyUnpublished'),
    columns: [
      {
        key: 'name',
        label: t('goods.products.columns.name'),
        sortable: true,
        default: true,
        render: (product) => {
          const variants = product.variants?.filter((variant) => variant.options_text?.trim())
          return (
            <ProductIdentity
              name={product.name}
              thumbnailUrl={product.thumbnail_url}
              subtitle={
                variants && variants.length > 0
                  ? t('goods.products.variantCount', { count: variants.length })
                  : undefined
              }
              render={
                <Link
                  to="/$storeId/goods/products/$productId"
                  params={{ storeId, productId: product.id }}
                />
              }
            />
          )
        },
      },
      ...(['sku', 'barcode', 'unit'] as const).map((key) => ({
        key,
        label: t(`goods.products.columns.${key}`),
        default: true,
        className: 'text-muted-foreground',
        render: (product: GoodsListProduct) => cells(product)[key],
      })),
      {
        key: 'cost_price',
        label: t('goods.products.columns.cost_price'),
        default: false,
        className: 'text-right tabular-nums whitespace-nowrap',
        render: (product) => cells(product).cost_price,
      },
      {
        key: 'price',
        label: t('goods.products.columns.price'),
        sortable: true,
        default: true,
        className: 'text-right tabular-nums whitespace-nowrap',
        render: (product) => cells(product).price,
      },
      {
        key: 'tax',
        label: t('goods.products.columns.tax'),
        default: false,
        render: (product) => cells(product).tax,
      },
      {
        key: 'status',
        label: t('goods.products.columns.status'),
        sortable: true,
        filterable: true,
        default: true,
        filterType: 'enum',
        quickFilter: true,
        filterOptions: STATUSES.map((value) => ({
          value,
          label: t(`goods.products.status.${value}`),
        })),
        render: (product) => <StatusBadge status={product.status} label={cells(product).status} />,
      },
      {
        key: 'stock',
        label: t('goods.products.columns.stock'),
        labelHint: t('goods.products.stockHint'),
        default: true,
        className: 'text-right tabular-nums',
        render: (product) => {
          const stock = productStock(product, cellContext.locationIds)
          const negative = stock.tracked && stock.onHand < 0
          return (
            <span
              className={negative ? 'font-medium text-destructive' : undefined}
              data-negative={negative || undefined}
            >
              {cells(product).stock}
            </span>
          )
        },
      },
      {
        key: 'product_type',
        label: t('goods.products.columns.product_type'),
        filterable: true,
        default: true,
        filterType: 'enum',
        filterOptions: typeOptions,
        ransackAttribute: 'product_type_id',
        render: (product) => cells(product).product_type,
      },
      {
        key: 'categories',
        label: t('goods.products.columns.categories'),
        filterable: true,
        displayable: false,
        filterType: 'enum',
        filterOptions: categoryOptions,
        ransackAttribute: 'categories_id',
      },
      {
        key: 'track_inventory',
        label: t('goods.products.columns.track_inventory'),
        filterable: true,
        displayable: false,
        filterType: 'boolean',
        booleanLabels: {
          true: t('goods.products.tracked'),
          false: t('goods.products.untracked'),
        },
        ransackAttribute: 'default_variant_track_inventory',
      },
    ],
  })

  const bulkActions = useMemo<BulkAction<unknown>[]>(() => {
    if (!canWrite) return []
    const status: BulkAction<{ status: Status }> = {
      key: 'set-status',
      label: t('goods.products.bulk.status'),
      icon: <TagIcon className="size-4" />,
      form: (props) => <StatusDialog {...props} />,
      run: ({ ids, formValues }) =>
        adminClient.products.bulkStatusUpdate({ ids, status: formValues?.status ?? 'active' }),
      successMessage: t('goods.products.bulk.statusDone'),
      errorMessage: t('goods.products.bulk.failed'),
    }
    const addCategories: BulkAction<{ categoryIds: string[] }> = {
      key: 'add-categories',
      label: t('goods.products.bulk.categories'),
      icon: <FolderPlusIcon className="size-4" />,
      form: (props) => <CategoriesDialog {...props} />,
      run: ({ ids, formValues }) =>
        adminClient.products.bulkAddToCategories({
          ids,
          category_ids: formValues?.categoryIds ?? [],
        }),
      invalidate: [goodsKey(storeId)],
      successMessage: t('goods.products.bulk.categoriesDone'),
      errorMessage: t('goods.products.bulk.failed'),
    }
    const publish: BulkAction<unknown> = {
      key: 'publish-pos',
      label: t('goods.products.bulk.publish'),
      icon: <RadioTowerIcon className="size-4" />,
      run: async ({ ids }) => {
        const channel = await setup.ensurePosChannel()
        return adminClient.products.bulkAddToChannels({ ids, channel_ids: [channel.id] })
      },
      invalidate: [goodsKey(storeId)],
      successMessage: t('goods.products.bulk.publishDone'),
      errorMessage: t('goods.products.bulk.failed'),
    }
    const destroy: BulkAction<unknown> = {
      key: 'delete',
      label: t('goods.products.delete'),
      confirm: {
        title: t('goods.products.bulk.deleteTitle'),
        message: t('goods.products.bulk.deleteConfirm'),
        confirmLabel: t('goods.products.delete'),
        variant: 'destructive',
      },
      run: async ({ ids }) => {
        setNotice(null)
        const { product_count } = await adminClient.products.bulkDestroy({ ids })
        const outcome = bulkDeleteOutcome(ids.length, product_count)
        if (outcome.refused > 0)
          setNotice({
            text: t('goods.products.bulk.deleteRefused', { count: outcome.refused }),
            failed: true,
          })
        return { count: outcome.count }
      },
      invalidate: [goodsKey(storeId)],
      successMessage: t('goods.products.bulk.deleteDone'),
      errorMessage: t('goods.products.bulk.failed'),
    }
    return [
      ...(view === 'unpublished' ? [publish] : []),
      status,
      addCategories,
      destroy,
    ] as BulkAction<unknown>[]
  }, [canWrite, t, view, storeId, setup])

  // The rows the table shows now, every page of them, with the columns on.
  async function exportCsv(ctx: ResourceActionsContext) {
    setNotice(null)
    setExporting(true)
    try {
      const params: Record<string, unknown> = {
        ...viewQuery[view],
        expand: PRODUCT_EXPAND,
        sort: searchParams.sort
          ? `${searchParams.dir === 'desc' ? '-' : ''}${searchParams.sort}`
          : 'name',
        ...(ctx.search ? { [ctx.searchParam]: ctx.search } : {}),
        ...filtersToRansack(ctx.filters, ctx.columns),
      }
      const rows = await readAllGoodsProducts(params as ProductListParams)
      const shown = searchParams.columns ?? defaultColumns()
      const columns = GOODS_COLUMNS.filter((key) => key === 'name' || shown.includes(key))
      const header = columns.map((key) => t(`goods.products.columns.${key}`))
      const body = rows.map((row) => {
        const text = cells(row)
        return columns.map((key: GoodsColumn) => text[key])
      })
      downloadCsv(toCsv([header, ...body]), `san-pham-${new Date().toISOString().slice(0, 10)}.csv`)
      setNotice({ text: t('goods.products.exported', { count: rows.length }), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('goods.products.title')}
        actions={
          canWrite ? (
            <Button
              onClick={() => navigate({ to: '/$storeId/goods/products/new', params: { storeId } })}
            >
              <PlusIcon className="size-4" />
              {t('goods.products.create')}
            </Button>
          ) : (
            <Badge variant="outline">{t('adminReadAccess')}</Badge>
          )
        }
      />
      <p className="text-base text-muted-foreground">
        {t(view === 'pos' ? 'goods.products.hintPos' : 'goods.products.hintUnpublished')}
      </p>
      {notice && (
        <p
          role={notice.failed ? 'alert' : 'status'}
          className={notice.failed ? 'text-destructive' : 'text-muted-foreground'}
        >
          {notice.text}
        </p>
      )}
      <ResourceTable<GoodsListProduct>
        tableKey={TABLE_KEY}
        hideHeader
        queryKey={['pos', storeId, 'goods', 'products-table']}
        queryFn={(params: ProductListParams) => readGoodsProducts(params)}
        defaultParams={{ expand: PRODUCT_EXPAND }}
        views={[
          { key: 'pos', label: t('goods.products.viewPos'), params: viewQuery.pos },
          {
            key: 'unpublished',
            label: t('goods.products.viewUnpublished'),
            params: viewQuery.unpublished,
          },
        ]}
        searchParams={searchParams}
        bulkActions={bulkActions}
        actions={(ctx) => (
          <>
            {canWrite && (
              <ImportButton
                type="products"
                subject={Subject.Product}
                label={t('goods.products.import')}
                onCreated={(created) => setImportId(created.id)}
              />
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-[2.125rem]"
              disabled={exporting}
              onClick={() => void exportCsv(ctx)}
            >
              <DownloadIcon className="size-4" />
              {t(exporting ? 'waiting' : 'goods.products.export')}
            </Button>
          </>
        )}
        rowActions={(product) => (
          <RowActions
            actions={[
              {
                key: 'edit',
                label: t('adminEdit'),
                onSelect: () =>
                  navigate({
                    to: '/$storeId/goods/products/$productId',
                    params: { storeId, productId: product.id },
                  }),
              },
              {
                key: 'clone',
                label: t('goods.products.clone'),
                visible: canWrite,
                disabled: write.isPending,
                onSelect: () => void clone(product),
              },
              {
                key: product.status === 'active' ? 'stop' : 'resume',
                label: t(
                  product.status === 'active' ? 'goods.products.stop' : 'goods.products.resume',
                ),
                icon:
                  product.status === 'active' ? (
                    <ArchiveIcon className="size-4" />
                  ) : (
                    <RotateCcwIcon className="size-4" />
                  ),
                visible: canWrite,
                destructive: product.status === 'active',
                disabled: write.isPending,
                onSelect: () => void toggleSale(product),
              },
              {
                key: 'delete',
                label: t('goods.products.delete'),
                visible: canWrite,
                destructive: true,
                disabled: write.isPending,
                onSelect: () => void remove(product),
              },
            ]}
          />
        )}
      />
      {importId && <ImportWizardDialog importId={importId} onClose={() => setImportId(null)} />}
    </div>
  )
}

const defaultColumns = () =>
  getTable(TABLE_KEY)
    .columns.filter((column) => column.default)
    .map((column) => column.key)

function StatusDialog({ onSubmit, onCancel }: BulkActionFormProps<{ status: Status }>) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>('active')
  return (
    <BulkDialog
      title={t('goods.products.bulk.status')}
      submitLabel={t('goods.products.bulk.apply')}
      onCancel={onCancel}
      onSubmit={() => onSubmit({ status })}
    >
      <TopologyField label={t('goods.products.columns.status')}>
        {(id) => (
          <TopologySelect
            id={id}
            value={status}
            options={STATUSES.map((value) => ({
              value,
              label: t(`goods.products.status.${value}`),
            }))}
            onChange={(value) => setStatus(value as Status)}
          />
        )}
      </TopologyField>
    </BulkDialog>
  )
}

function CategoriesDialog({ onSubmit, onCancel }: BulkActionFormProps<{ categoryIds: string[] }>) {
  const { t } = useTranslation()
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  return (
    <BulkDialog
      title={t('goods.products.bulk.categories')}
      submitLabel={t('goods.products.bulk.apply')}
      submitDisabled={categoryIds.length === 0}
      onCancel={onCancel}
      onSubmit={() => onSubmit({ categoryIds })}
    >
      <CategoryChecklist value={categoryIds} onChange={setCategoryIds} allowCreate={false} />
    </BulkDialog>
  )
}
