import { formatMoney } from '@parkviet/pos-shared/money'
import { describeFailure } from '@parkviet/pos-shared/request-failure'
import { PageHeader, usePermissions } from '@spree/dashboard-core'
import {
  Badge,
  Button,
  Card,
  CardContent,
  RowActions,
  SearchInput,
  useConfirm,
} from '@spree/dashboard-ui'
import { PlusIcon } from '@spree/dashboard-ui/icons'
import { ChefHat } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import { GoodsRecipeSheet, type RecipeTarget } from '../components/goods-recipe-sheet'
import { MasterNotice } from '../components/master-page'
import { recipeFailure } from '../components/recipe-editor'
import { useGoodsProductTypes } from '../hooks/use-goods'
import { usePosSession } from '../hooks/use-pos-session'
import { type RecipeListRow, useRecipeList, useSaveRecipe } from '../hooks/use-recipes'
import { canReadProductTypes, canWriteGoods, type PosAccess, runsRecipes } from '../lib/pos-access'

type Notice = { text: string; failed: boolean } | null
const PAGE_SIZE = 24

const targetOf = (row: RecipeListRow): RecipeTarget => ({
  ref:
    row.owner_type === 'variant'
      ? { variant_id: row.owner_id }
      : { modifier_option_id: row.owner_id },
  name: row.name,
  detail: row.owner_type === 'variant' ? row.options_text : row.group_name,
  sku: row.sku,
  productId: row.product_id,
  costPrice: row.cost_price,
})
const labelOf = (row: RecipeListRow) =>
  [row.name, row.owner_type === 'variant' ? row.options_text : null].filter(Boolean).join(' · ')

// "Công thức chế biến": the store's recipes as cards, searched and paged on
// the server. Product variants and add-on options both have recipes; a
// recipe is written here even while the selected branch does not run the
// recipes module, which only decides where ingredients are taken from stock.
export function GoodsRecipesPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { context, selection } = usePosSession()
  const { permissionKeys } = usePermissions()
  const access: PosAccess = { permissionKeys, context: context.data }
  const typesReadable = canReadProductTypes(access)
  const types = useGoodsProductTypes(typesReadable)
  const saveRecipe = useSaveRecipe()
  const currency = context.data?.store.currency ?? 'VND'
  const branch = context.data?.branches.find((row) => row.id === selection.branchId) ?? null
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<Notice>(null)
  const [editor, setEditor] = useState<{ target: RecipeTarget | null } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(term.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [term])
  const list = useRecipeList({ q: search || undefined, page, limit: PAGE_SIZE })
  const rows = list.data?.data ?? []
  const meta = list.data?.meta

  async function remove(row: RecipeListRow) {
    const name = labelOf(row)
    if (
      !(await confirm({
        message: t('goods.recipes.deleteConfirm', { name }),
        variant: 'destructive',
        confirmLabel: t('goods.recipes.delete'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    setNotice(null)
    try {
      await saveRecipe.mutateAsync({ ...targetOf(row).ref, ingredients: [] })
      setNotice({ text: t('goods.recipes.deleted', { name }), failed: false })
    } catch (failure) {
      setNotice({ text: recipeFailure(failure, t), failed: true })
    }
  }
  function edit(row?: RecipeListRow) {
    setNotice(null)
    setEditor({ target: row ? targetOf(row) : null })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('goods.recipes.title')}
        actions={
          <div className="flex items-center gap-2">
            <BranchPicker />
            <Button onClick={() => edit()}>
              <PlusIcon className="size-4" />
              {t('goods.recipes.create')}
            </Button>
          </div>
        }
      />
      <p className="text-base text-muted-foreground">{t('goods.recipes.hint')}</p>
      {branch && context.data && !runsRecipes(access) && (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          {t('goods.recipes.moduleNote', { branch: branch.name })}
        </p>
      )}
      <MasterNotice notice={notice} />
      <SearchInput
        value={term}
        onValueChange={setTerm}
        placeholder={t('goods.recipes.searchPlaceholder')}
        aria-label={t('goods.recipes.searchPlaceholder')}
        clearLabel={t('goods.recipes.clearSearch')}
        className="h-[2.125rem] max-w-sm"
      />
      {list.isError ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>{describeFailure(list.error, t)}</p>
          <Button size="sm" variant="outline" onClick={() => void list.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {list.isPending
            ? t('waiting')
            : t(search ? 'goods.recipes.noMatch' : 'goods.recipes.empty')}
        </p>
      ) : (
        <ul
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          aria-label={t('goods.recipes.title')}
        >
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="h-full" data-recipe={row.owner_id}>
                <CardContent className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <ChefHat className="size-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <button
                      type="button"
                      className="block max-w-full truncate text-left font-medium hover:underline"
                      onClick={() => edit(row)}
                    >
                      {labelOf(row)}
                    </button>
                    {row.owner_type === 'modifier_option' && row.group_name && (
                      <Badge variant="outline">
                        {t('goods.recipes.optionOf', { group: row.group_name })}
                      </Badge>
                    )}
                    {row.sku && (
                      <p className="text-sm text-muted-foreground">
                        {t('goods.recipes.sku', { sku: row.sku })}
                      </p>
                    )}
                    <p className="text-sm tabular-nums">
                      {row.estimated_cost === null ? (
                        <span className="text-muted-foreground">
                          {t('goods.recipes.costUnknown')}
                        </span>
                      ) : (
                        t('goods.recipes.cost', {
                          cost: formatMoney(row.estimated_cost, currency),
                        })
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t('goods.recipes.ingredientCount', { count: row.ingredients })}
                    </p>
                  </div>
                  <RowActions
                    actions={[
                      {
                        key: 'edit',
                        label: t('adminEdit'),
                        disabled: saveRecipe.isPending,
                        onSelect: () => edit(row),
                      },
                      {
                        key: 'delete',
                        label: t('goods.recipes.delete'),
                        destructive: true,
                        disabled: saveRecipe.isPending,
                        onSelect: () => void remove(row),
                      },
                    ]}
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground">
            {t('goods.recipes.page', { page: meta.page, pages: meta.pages })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            {t('goods.recipes.previous')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={meta.next === null}
            onClick={() => setPage((value) => value + 1)}
          >
            {t('goods.recipes.next')}
          </Button>
        </div>
      )}
      {editor && (
        <GoodsRecipeSheet
          target={editor.target}
          ingredientTypeId={types.data?.byKind.ingredient?.id ?? null}
          ingredientsReadable={typesReadable && types.isSuccess}
          canWriteCost={canWriteGoods(access)}
          currency={currency}
          onSaved={(text) => setNotice({ text, failed: false })}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}
