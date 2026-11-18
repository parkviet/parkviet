import { describeFailure } from '@parkviet/pos-shared/request-failure'
import {
  adminClient,
  defineTable,
  mapSpreeErrorsToForm,
  PageHeader,
  ResourceTable,
  usePermissions,
} from '@spree/dashboard-core'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  DialogBody,
  DialogFooter,
  Pagination,
  ProductIdentity,
  ResourceNameCell,
  RowActions,
  SearchInput,
  Tabs,
  TabsList,
  TabsTrigger,
  useConfirm,
  useDebouncedValue,
  useRowClickBridge,
} from '@spree/dashboard-ui'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  FolderTreeIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  XIcon,
} from '@spree/dashboard-ui/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { type ReactNode, useCallback, useId, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { MasterNotice } from '../components/master-page'
import { TopologyDialog } from '../components/topology-dialog'
import { Input, TopologyField, TopologySelect } from '../components/topology-fields'
import {
  goodsKey,
  readGoodsCategories,
  useGoodsCategories,
  useGoodsWrite,
} from '../hooks/use-goods'
import {
  type PickedProduct,
  pickedProduct,
  type SavedCategory,
  saveCategory,
  useCategoryProducts,
  useProductPicker,
} from '../hooks/use-goods-categories'
import { useSession } from '../hooks/use-session'
import {
  categoryLabel,
  categoryTree,
  lastIndexUnder,
  stepIndex,
  subtreeIds,
  type TreeCategory,
} from '../lib/goods-categories'
import { canWriteCategories } from '../lib/pos-access'
import { goodsCategorySearchSchema } from '../schemas/goods-category-search'
import { localList } from '../tables/local-list'

const TABLE_KEY = 'pos-goods-categories'
const ROW_ATTRIBUTE = 'data-pos-category-id' as const
type Notice = { text: string; failed: boolean } | null

// The store's Spree categories, as a list or a grid. A product belongs to any
// number of them; deleting a category (and the ones under it) keeps the products.
export function GoodsCategoriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const client = useQueryClient()
  const { storeId } = useSession()
  const { permissionKeys } = usePermissions()
  const canWrite = canWriteCategories({ permissionKeys })
  const searchParams = goodsCategorySearchSchema.parse(useSearch({ strict: false }))
  const layout = searchParams.layout ?? 'list'
  const categories = useGoodsCategories()
  const tree = useMemo(() => categoryTree(categories.data ?? []), [categories.data])
  const [editor, setEditor] = useState<{ category?: TreeCategory } | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const write = useGoodsWrite(async (run: () => Promise<unknown>) => run())

  async function act(run: () => Promise<unknown>, success: string) {
    setNotice(null)
    try {
      await write.mutateAsync(run)
      setNotice({ text: success, failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }
  async function move(row: TreeCategory, step: -1 | 1) {
    const index = stepIndex(row, step)
    if (index === null || write.isPending) return
    await act(
      () =>
        adminClient.categories.reposition(row.id, {
          new_parent_id: row.parent_id,
          new_position: index,
        }),
      t('goods.categories.moved', { name: row.name }),
    )
  }
  async function remove(row: TreeCategory) {
    if (
      !(await confirm({
        message: t(
          row.children_count > 0
            ? 'goods.categories.deleteConfirmChildren'
            : 'goods.categories.deleteConfirm',
          { name: row.name, count: row.children_count },
        ),
        variant: 'destructive',
        confirmLabel: t('goods.categories.delete'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    await act(
      () => adminClient.categories.delete(row.id),
      t('goods.categories.deleted', { name: row.name }),
    )
  }
  function edit(category?: TreeCategory) {
    setNotice(null)
    setEditor({ category })
  }
  const rowsById = useRef(new Map<string, TreeCategory>())
  rowsById.current = new Map(tree.map((row) => [row.id, row]))
  const openRow = useRef<(id: string) => void>(() => {})
  openRow.current = (id) => {
    const row = rowsById.current.get(id)
    if (row && canWrite) edit(row)
  }
  const onRowClick = useCallback((id: string) => openRow.current(id), [])
  useRowClickBridge(ROW_ATTRIBUTE, onRowClick)

  const actionsFor = (row: TreeCategory) => (
    <RowActions
      actions={[
        {
          key: 'edit',
          label: t('adminEdit'),
          visible: canWrite,
          disabled: write.isPending,
          onSelect: () => edit(row),
        },
        {
          key: 'delete',
          label: t('goods.categories.delete'),
          visible: canWrite,
          destructive: true,
          disabled: write.isPending,
          onSelect: () => void remove(row),
        },
      ]}
    />
  )

  defineTable<TreeCategory>(TABLE_KEY, {
    searchParam: 'search',
    searchPlaceholder: t('goods.categories.searchPlaceholder'),
    defaultSort: { field: 'position', direction: 'asc' },
    emptyIcon: <FolderTreeIcon className="size-8 text-muted-foreground" />,
    emptyMessage: t('goods.categories.empty'),
    columns: [
      {
        key: 'name',
        label: t('goods.categories.columns.name'),
        sortable: true,
        default: true,
        render: (row) => (
          <ResourceNameCell
            id={row.id}
            dataAttr={canWrite ? ROW_ATTRIBUTE : undefined}
            name={row.name}
            secondary={row.parent_id ? categoryLabel(row) : undefined}
          />
        ),
      },
      {
        key: 'products_count',
        label: t('goods.categories.columns.products'),
        sortable: true,
        default: true,
        className: 'tabular-nums',
        render: (row) => t('goods.categories.productCount', { count: row.products_count }),
      },
      {
        key: 'position',
        label: t('goods.categories.columns.position'),
        labelHint: t('goods.categories.positionHint'),
        sortable: true,
        default: true,
        render: (row) => (
          <span className="flex items-center gap-1">
            <span className="min-w-6 tabular-nums text-muted-foreground">
              {row.siblingIndex + 1}
            </span>
            {canWrite && (
              <>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('goods.categories.moveUp', { name: row.name })}
                  disabled={write.isPending || stepIndex(row, -1) === null}
                  onClick={() => void move(row, -1)}
                >
                  <ChevronUpIcon className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('goods.categories.moveDown', { name: row.name })}
                  disabled={write.isPending || stepIndex(row, 1) === null}
                  onClick={() => void move(row, 1)}
                >
                  <ChevronDownIcon className="size-4" />
                </Button>
              </>
            )}
          </span>
        ),
      },
    ],
  })

  const setLayout = (value: string) =>
    navigate({
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        layout: value === 'grid' ? 'grid' : undefined,
      })) as never,
    })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('goods.categories.title')}
        actions={
          canWrite ? (
            <Button onClick={() => edit()}>
              <PlusIcon className="size-4" />
              {t('goods.categories.create')}
            </Button>
          ) : (
            <Badge variant="outline">{t('adminReadAccess')}</Badge>
          )
        }
      />
      <p className="text-base text-muted-foreground">{t('goods.categories.hint')}</p>
      <Tabs value={layout} onValueChange={(value) => setLayout(String(value))}>
        <TabsList aria-label={t('goods.categories.layout')}>
          <TabsTrigger value="list">
            <ListIcon className="size-4" />
            {t('goods.categories.layoutList')}
          </TabsTrigger>
          <TabsTrigger value="grid">
            <LayoutGridIcon className="size-4" />
            {t('goods.categories.layoutGrid')}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <MasterNotice notice={notice} />
      {layout === 'list' ? (
        <ResourceTable<TreeCategory>
          tableKey={TABLE_KEY}
          hideHeader
          queryKey={['pos', storeId, 'goods', 'categories-table']}
          queryFn={async (params: Record<string, unknown>) => {
            const all = await client.fetchQuery({
              queryKey: goodsKey(storeId, 'categories'),
              queryFn: readGoodsCategories,
            })
            return localList(categoryTree(all), params, {
              searchParam: 'search',
              text: (row) => `${row.name} ${row.pretty_name}`,
              sortValue: (row, field) =>
                field === 'position'
                  ? String(row.lft)
                  : field === 'products_count'
                    ? String(row.products_count)
                    : field === 'name'
                      ? categoryLabel(row)
                      : undefined,
            })
          }}
          searchParams={searchParams}
          rowActions={actionsFor}
        />
      ) : (
        <CategoryGrid
          rows={tree}
          loading={categories.isPending}
          error={categories.isError ? describeFailure(categories.error, t) : ''}
          search={searchParams.search ?? ''}
          onSearch={(value) =>
            navigate({
              search: ((prev: Record<string, unknown>) => ({
                ...prev,
                search: value || undefined,
                page: 1,
              })) as never,
            })
          }
          canWrite={canWrite}
          onOpen={edit}
          actionsFor={actionsFor}
        />
      )}
      {editor && canWrite && (
        <CategoryDialog
          category={editor.category}
          categories={tree}
          onSaved={(name) =>
            setNotice({ text: t('goods.categories.saved', { name }), failed: false })
          }
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}

function CategoryGrid({
  rows,
  loading,
  error,
  search,
  onSearch,
  canWrite,
  onOpen,
  actionsFor,
}: {
  rows: TreeCategory[]
  loading: boolean
  error: string
  search: string
  onSearch: (value: string) => void
  canWrite: boolean
  onOpen: (row: TreeCategory) => void
  actionsFor: (row: TreeCategory) => ReactNode
}) {
  const { t } = useTranslation()
  const term = search.trim().toLocaleLowerCase()
  const shown = term
    ? rows.filter((row) => `${row.name} ${row.pretty_name}`.toLocaleLowerCase().includes(term))
    : rows
  return (
    <div className="space-y-4">
      <SearchInput
        value={search}
        onValueChange={onSearch}
        placeholder={t('goods.categories.searchPlaceholder')}
        aria-label={t('goods.categories.searchPlaceholder')}
        clearLabel={t('goods.categories.clearSearch')}
        className="h-[2.125rem] max-w-sm"
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {loading ? t('waiting') : t('goods.categories.empty')}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((row) => (
            <li key={row.id}>
              <Card className="h-full" data-category-card={row.id}>
                <CardContent className="flex items-start gap-3">
                  {row.image_url ? (
                    <img
                      src={row.image_url}
                      alt=""
                      className="size-12 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                      <FolderTreeIcon className="size-5 text-muted-foreground" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {canWrite ? (
                      <button
                        type="button"
                        className="block max-w-full truncate text-left font-medium hover:underline"
                        onClick={() => onOpen(row)}
                      >
                        {row.name}
                      </button>
                    ) : (
                      <p className="truncate font-medium">{row.name}</p>
                    )}
                    {row.parent_id && (
                      <p className="truncate text-xs text-muted-foreground">{categoryLabel(row)}</p>
                    )}
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {t('goods.categories.productCount', { count: row.products_count })}
                    </p>
                  </div>
                  {actionsFor(row)}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

type Values = { name: string; parentId: string }

// Create or edit one category: the store's products to pick from on the left,
// the name, parent and picked products on the right. An empty category saves.
function CategoryDialog({
  category,
  categories,
  onSaved,
  onClose,
}: {
  category?: TreeCategory
  categories: TreeCategory[]
  onSaved: (name: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const client = useQueryClient()
  const { storeId } = useSession()
  const write = useGoodsWrite(async (run: () => Promise<unknown>) => run())
  const form = useForm<Values>({
    defaultValues: { name: category?.name ?? '', parentId: category?.parent_id ?? '' },
  })
  const draft = form.watch()
  const members = useCategoryProducts(category?.id)
  const [picked, setPicked] = useState<PickedProduct[] | null>(category ? null : [])
  const selected = picked ?? members.data?.map(pickedProduct) ?? []
  const membersLoading = Boolean(category) && picked === null && members.isPending
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const search = useDebouncedValue(term, 300)
  const products = useProductPicker(search, page)
  const saved = useRef<SavedCategory | null>(
    category ? null : { name: '', parentId: null, productIds: [] },
  )
  const [error, setError] = useState('')
  const busy = form.formState.isSubmitting
  const dirty = form.formState.isDirty || picked !== null
  const blocked = subtreeIds(categories, category?.id ?? '')
  const parents = categories.filter((row) => !blocked.has(row.id))
  const selectedIds = new Set(selected.map((row) => row.id))
  const pageRows = (products.data?.data ?? []).map(pickedProduct)

  const toggle = (product: PickedProduct, on: boolean) =>
    setPicked(
      on
        ? [...selected.filter((row) => row.id !== product.id), product]
        : selected.filter((row) => row.id !== product.id),
    )
  const pickPage = () =>
    setPicked([...selected, ...pageRows.filter((row) => !selectedIds.has(row.id))])

  async function submit(values: Values) {
    form.clearErrors()
    const name = values.name.trim()
    if (!name) {
      form.setError('name', { message: t('goods.categories.nameRequired') })
      return
    }
    // An edit starts from the members as read; a retried save from what it saved.
    if (!saved.current) {
      if (!category || !members.data) return
      saved.current = {
        id: category.id,
        name: category.name,
        parentId: category.parent_id,
        productIds: members.data.map((row) => row.id),
      }
    }
    const parentId = values.parentId || null
    setError('')
    try {
      await write.mutateAsync(() =>
        saveCategory(
          saved.current as SavedCategory,
          {
            name,
            parentId,
            productIds: selected.map((row) => row.id),
            lastIndex: lastIndexUnder(categories, parentId, saved.current?.id),
          },
          (next) => {
            saved.current = next
          },
        ),
      )
      onSaved(name)
      onClose()
    } catch (failure) {
      mapSpreeErrorsToForm(failure, form.setError)
      setError(describeFailure(failure, t))
      // Steps that went through before the failure are shown on the page.
      if (saved.current?.id) void client.invalidateQueries({ queryKey: goodsKey(storeId) })
    }
  }

  return (
    <TopologyDialog
      title={t(category ? 'goods.categories.editTitle' : 'goods.categories.createTitle')}
      subtitle={category?.name}
      dirty={dirty}
      busy={busy}
      wide
      onClose={onClose}
    >
      {(close) => (
        <form
          onSubmit={form.handleSubmit(submit)}
          aria-busy={busy}
          className="flex min-h-0 flex-col"
        >
          <DialogBody>
            <fieldset disabled={busy} className="grid gap-6 md:grid-cols-2">
              <section aria-labelledby={`${id}-picker`} className="flex min-w-0 flex-col gap-3">
                <h3 id={`${id}-picker`} className="text-sm font-medium">
                  {t('goods.categories.products')}
                </h3>
                <SearchInput
                  value={term}
                  onValueChange={(value) => {
                    setTerm(value)
                    setPage(1)
                  }}
                  placeholder={t('goods.categories.pickerSearch')}
                  aria-label={t('goods.categories.pickerSearch')}
                  clearLabel={t('goods.categories.clearSearch')}
                  className="h-[2.125rem]"
                />
                {products.isError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {describeFailure(products.error, t)}
                  </p>
                ) : pageRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {products.isPending ? t('waiting') : t('goods.categories.pickerEmpty')}
                  </p>
                ) : (
                  <>
                    <ul
                      className="max-h-80 divide-y overflow-y-auto rounded-md border"
                      aria-label={t('goods.categories.products')}
                    >
                      {pageRows.map((product) => (
                        <li key={product.id} className="flex items-center gap-3 px-3 py-2">
                          <Checkbox
                            id={`${id}-pick-${product.id}`}
                            aria-label={product.name}
                            checked={selectedIds.has(product.id)}
                            disabled={membersLoading}
                            onCheckedChange={(checked) => toggle(product, checked === true)}
                          />
                          <label htmlFor={`${id}-pick-${product.id}`} className="min-w-0 flex-1">
                            <ProductIdentity
                              name={product.name}
                              subtitle={product.sku || undefined}
                              thumbnailUrl={product.thumbnailUrl}
                              size="sm"
                            />
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          membersLoading || pageRows.every((row) => selectedIds.has(row.id))
                        }
                        onClick={pickPage}
                      >
                        {t('goods.categories.selectPage')}
                      </Button>
                    </div>
                    {products.data && products.data.meta.pages > 1 && (
                      <Pagination meta={products.data.meta} onPageChange={setPage} />
                    )}
                  </>
                )}
              </section>
              <section className="flex min-w-0 flex-col gap-4">
                <TopologyField
                  label={t('goods.categories.name')}
                  error={form.formState.errors.name?.message}
                >
                  {(fieldId, describedBy) => (
                    <Input
                      id={fieldId}
                      aria-describedby={describedBy}
                      aria-invalid={Boolean(form.formState.errors.name)}
                      maxLength={120}
                      value={draft.name}
                      onChange={(event) =>
                        form.setValue('name', event.target.value, { shouldDirty: true })
                      }
                    />
                  )}
                </TopologyField>
                {parents.length > 0 && (
                  <TopologyField
                    label={t('goods.categories.parent')}
                    hint={t('goods.categories.parentHint')}
                  >
                    {(fieldId, describedBy) => (
                      <TopologySelect
                        id={fieldId}
                        describedBy={describedBy}
                        value={draft.parentId}
                        options={[
                          { value: '', label: t('goods.categories.parentNone') },
                          ...parents.map((row) => ({ value: row.id, label: categoryLabel(row) })),
                        ]}
                        onChange={(value) =>
                          form.setValue('parentId', value, { shouldDirty: true })
                        }
                      />
                    )}
                  </TopologyField>
                )}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">
                    {t('goods.categories.selected', { count: selected.length })}
                  </h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={selected.length === 0}
                    onClick={() => setPicked([])}
                  >
                    {t('goods.categories.removeAll')}
                  </Button>
                </div>
                {members.isError && picked === null ? (
                  <p role="alert" className="text-sm text-destructive">
                    {describeFailure(members.error, t)}
                  </p>
                ) : membersLoading ? (
                  <p className="text-sm text-muted-foreground">{t('waiting')}</p>
                ) : selected.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('goods.categories.selectedEmpty')}
                  </p>
                ) : (
                  <ul
                    className="max-h-80 divide-y overflow-y-auto rounded-md border"
                    aria-label={t('goods.categories.selectedList')}
                  >
                    {selected.map((product) => (
                      <li key={product.id} className="flex items-center gap-3 px-3 py-2">
                        <ProductIdentity
                          name={product.name}
                          subtitle={product.sku || undefined}
                          thumbnailUrl={product.thumbnailUrl}
                          size="sm"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t('goods.categories.removeOne', { name: product.name })}
                          onClick={() => toggle(product, false)}
                        >
                          <XIcon className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </fieldset>
            {error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              {t('adminCancel')}
            </Button>
            <Button
              type="submit"
              disabled={busy || !dirty || membersLoading || (members.isError && picked === null)}
            >
              {t(busy ? 'waiting' : 'save')}
            </Button>
          </DialogFooter>
        </form>
      )}
    </TopologyDialog>
  )
}
