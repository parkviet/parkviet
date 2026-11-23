import { describeFailure } from '@shared/request-failure'
import {
  defineTable,
  ResourceTable,
  resourceSearchSchema,
  useResourceMutation,
} from '@spree/dashboard-core'
import {
  Badge,
  Button,
  Checkbox,
  ResourceNameCell,
  RowActions,
  SectionTitle,
  useConfirm,
} from '@spree/dashboard-ui'
import {
  PackageCheckIcon,
  PackageIcon,
  PackageXIcon,
  PrinterIcon,
  TagIcon,
} from '@spree/dashboard-ui/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type BranchScope, useBranchScope } from '../components/branch-detail'
import { PrintLabelsDialog } from '../components/product-label/print-labels-dialog'
import { VariantUnitEditor } from '../components/variant-unit-editor'
import {
  assignBranchProduct,
  type BranchProduct,
  fetchBranchProducts,
  removeBranchProduct,
} from '../hooks/use-branch-catalog'
import { fetchProductVariants, type LabelPrintItem } from '../hooks/use-product-label-data'
import { hiddenTimestamps } from '../tables/columns'

export function BranchProductsTab() {
  const scope = useBranchScope()
  return <BranchProducts key={scope.branch.id} {...scope} />
}
function BranchProducts({ branch, access, storeId }: BranchScope) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const client = useQueryClient()
  const searchParams = resourceSearchSchema.parse(useSearch({ strict: false }))
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const [unitProduct, setUnitProduct] = useState<BranchProduct | null>(null)
  // Rows of the page on screen and the ones ticked for labels. Only products
  // sold at the branch can be ticked, and only on the current page.
  const [pageRows, setPageRows] = useState<BranchProduct[]>([])
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [labelItems, setLabelItems] = useState<LabelPrintItem[] | null>(null)
  const [labelLoading, setLabelLoading] = useState(false)
  const sellable = pageRows.filter((product) => product.assigned)
  const pickedRows = sellable.filter((product) => picked.has(product.id))
  const allPicked = sellable.length > 0 && pickedRows.length === sellable.length
  const togglePicked = (id: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  async function openLabels() {
    if (pickedRows.length === 0 || labelLoading) return
    setNotice(null)
    setLabelLoading(true)
    try {
      const variants = await fetchProductVariants(branch.id, pickedRows)
      if (variants.length === 0) {
        setNotice({ text: t('productLabelPrint.noVariantsForProducts'), failed: true })
        return
      }
      setLabelItems(variants)
    } catch (failure) {
      setNotice({
        text: t('productLabelPrint.variantsFailed', { reason: describeFailure(failure, t) }),
        failed: true,
      })
    } finally {
      setLabelLoading(false)
    }
  }
  const mutation = useResourceMutation({
    mutationFn: async (product: BranchProduct) => {
      if (!access.write) throw Object.assign(new Error('Access denied'), { status: 403 })
      if (product.assigned) await removeBranchProduct(branch.id, product.id)
      else await assignBranchProduct(branch.id, product.id)
    },
    successMessage: false,
    errorMessage: false,
  })
  async function toggle(product: BranchProduct) {
    if (!access.write || mutation.isPending) return
    if (
      product.assigned &&
      !(await confirm({
        message: t('branchProductRemoveFor', { name: product.name }),
        variant: 'destructive',
        confirmLabel: t('branchProductRemove'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    setNotice(null)
    try {
      await mutation.mutateAsync(product)
      setNotice({
        text: t(product.assigned ? 'branchProductRemoved' : 'branchProductAdded', {
          name: product.name,
        }),
        failed: false,
      })
    } catch (failure) {
      setNotice({
        text: t('branchProductFailed', { name: product.name, reason: describeFailure(failure, t) }),
        failed: true,
      })
    } finally {
      await Promise.all(
        ['branch-products', 'catalog'].map((resource) =>
          client.invalidateQueries({ queryKey: ['pos', storeId, resource] }),
        ),
      )
    }
  }
  const tableKey = 'pos-branch-products'
  defineTable<BranchProduct>(tableKey, {
    searchParam: 'search',
    searchPlaceholder: t('branchProductsSearchPlaceholder'),
    emptyMessage: t('branchProductsEmpty'),
    columns: [
      {
        key: 'select',
        label: t('productLabelPrint.select'),
        default: true,
        className: 'w-8',
        render: (product) => (
          <Checkbox
            checked={picked.has(product.id)}
            disabled={!product.assigned}
            onCheckedChange={() => togglePicked(product.id)}
            aria-label={t(
              product.assigned ? 'productLabelPrint.selectRow' : 'productLabelPrint.selectDisabled',
              { name: product.name },
            )}
          />
        ),
      },
      {
        key: 'name',
        label: t('adminName'),
        default: true,
        render: (product) => (
          <ResourceNameCell
            id={product.id}
            name={product.name}
            secondary={[
              product.skus.length ? product.skus.join(', ') : t('branchProductNoSku'),
              ...(product.status === 'active'
                ? []
                : [t('branchProductStatus', { status: product.status })]),
            ].join(' · ')}
          />
        ),
      },
      {
        key: 'assigned',
        label: t('adminStatus'),
        default: true,
        filterable: true,
        filterType: 'enum',
        quickFilter: true,
        filterOptions: [
          { value: 'true', label: t('branchProductsFilterAssigned') },
          { value: 'false', label: t('branchProductsFilterUnassigned') },
        ],
        render: (product) => (
          <Badge variant={product.assigned ? 'default' : 'outline'}>
            {t(product.assigned ? 'branchProductAssigned' : 'branchProductUnassigned')}
          </Badge>
        ),
      },
      ...hiddenTimestamps<BranchProduct>(),
    ],
  })
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <SectionTitle>
          <PackageIcon />
          {t('branchTabs.products')}
        </SectionTitle>
        <p className="text-base text-muted-foreground">
          {t(access.write ? 'branchProductsHint' : 'branchProductsReadOnly')}
        </p>
      </div>
      {notice && (
        <p
          role={notice.failed ? 'alert' : 'status'}
          className={notice.failed ? 'text-destructive' : 'text-muted-foreground'}
        >
          {notice.text}
        </p>
      )}
      {sellable.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2"
          data-testid="label-selection-bar"
        >
          <div className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allPicked}
              indeterminate={pickedRows.length > 0 && !allPicked}
              onCheckedChange={() =>
                setPicked(allPicked ? new Set() : new Set(sellable.map((product) => product.id)))
              }
              aria-label={t('productLabelPrint.selectAll')}
            />
            {t('productLabelPrint.selectAll')}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pickedRows.length === 0 || labelLoading}
            onClick={() => void openLabels()}
          >
            <PrinterIcon className="size-4" />
            {t('productLabelPrint.action', { n: pickedRows.length })}
          </Button>
        </div>
      )}
      <ResourceTable<BranchProduct>
        tableKey={tableKey}
        hideHeader
        queryKey={['pos', 'branch-products', branch.id, 'table']}
        queryFn={async (params: Record<string, unknown>) => {
          const result = await fetchBranchProducts(branch.id, params)
          setPageRows(result.data)
          setPicked(new Set())
          return result
        }}
        searchParams={searchParams}
        rowActions={(product) => (
          <RowActions
            actions={[
              {
                key: 'units',
                label: t('branchProductUnits'),
                icon: <TagIcon className="size-4" />,
                visible: product.assigned,
                onSelect: () => setUnitProduct(product),
              },
              {
                key: product.assigned ? 'remove' : 'add',
                label: t(product.assigned ? 'branchProductRemove' : 'branchProductAdd'),
                icon: product.assigned ? (
                  <PackageXIcon className="size-4" />
                ) : (
                  <PackageCheckIcon className="size-4" />
                ),
                visible: access.write,
                destructive: product.assigned,
                disabled: mutation.isPending,
                onSelect: () => void toggle(product),
              },
            ]}
          />
        )}
      />
      {labelItems && (
        <PrintLabelsDialog
          branchId={branch.id}
          timeZone={branch.timezone || 'Asia/Ho_Chi_Minh'}
          items={labelItems}
          onClose={() => setLabelItems(null)}
        />
      )}
      {unitProduct && (
        <VariantUnitEditor
          branchId={branch.id}
          storeId={storeId}
          product={unitProduct}
          canWrite={access.write}
          onClose={() => setUnitProduct(null)}
        />
      )}
    </div>
  )
}
