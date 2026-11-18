import { formatMoney } from '@parkviet/pos-shared/money'
import { conflictReason, describeFailure } from '@parkviet/pos-shared/request-failure'
import { adminClient } from '@spree/dashboard-core'
import {
  Badge,
  Button,
  SearchInput,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  useConfirm,
} from '@spree/dashboard-ui'
import { MinusIcon, PlusIcon, TrashIcon } from '@spree/dashboard-ui/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { goodsKey, type ProductListParams } from '../hooks/use-goods'
import { type IngredientProduct, useGoodsIngredients } from '../hooks/use-goods-ingredients'
import { readUnits } from '../hooks/use-master-data'
import { type RecipeOwnerRef, readRecipeList, useRecipe } from '../hooks/use-recipes'
import { useSession } from '../hooks/use-session'
import { ingredientVariant } from '../lib/goods-ingredients'
import { type ProductSlice, sellingVariants } from '../lib/goods-products'
import {
  amountText,
  costPriceOf,
  followsRecipe,
  lineCost,
  lineFromIngredient,
  linesFromRecipe,
  linesValid,
  matchesTerm,
  type RecipeLine,
  type RecipeUnit,
  recipeCost,
  recipeRows,
  stepQuantity,
  unitsFor,
} from '../lib/goods-recipes'
import { posKey } from '../lib/query-keys'
import { PageSkeleton } from './page-skeleton'
import { recipeFailure, useConfirmedRecipeSave } from './recipe-editor'
import { Input, TopologySelect } from './topology-fields'

// What a recipe is for: a product variant (a size, or a simple product's
// only variant) or an add-on option. `productId` lets a variant's cost
// price follow its recipe.
export type RecipeTarget = {
  ref: RecipeOwnerRef
  name: string
  detail: string | null
  sku: string | null
  productId: string | null
  costPrice: string | null
}
type Notice = { text: string; failed: boolean }
const ownerIdOf = (ref: RecipeOwnerRef) =>
  'variant_id' in ref ? ref.variant_id : ref.modifier_option_id
const PICKER_LIMIT = 20
const INGREDIENT_MATCHES = 8

// The recipe drawer. Opened without a target it starts with choosing the
// product; "Save and create another" goes back to that choice.
export function GoodsRecipeSheet({
  target: initial,
  ingredientTypeId,
  ingredientsReadable,
  canWriteCost,
  currency,
  onSaved,
  onClose,
}: {
  target: RecipeTarget | null
  ingredientTypeId: string | null
  ingredientsReadable: boolean
  canWriteCost: boolean
  currency: string
  onSaved: (text: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const creating = initial === null
  const [target, setTarget] = useState<RecipeTarget | null>(initial)
  const [notice, setNotice] = useState<Notice | null>(null)
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent className="overflow-y-auto data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {t(creating ? 'goods.recipes.form.createTitle' : 'goods.recipes.form.editTitle')}
          </SheetTitle>
          <SheetDescription>{t('goods.recipes.form.intro')}</SheetDescription>
        </SheetHeader>
        {target ? (
          <RecipeForm
            key={ownerIdOf(target.ref)}
            target={target}
            creating={creating}
            ingredientTypeId={ingredientTypeId}
            ingredientsReadable={ingredientsReadable}
            canWriteCost={canWriteCost}
            currency={currency}
            notice={notice}
            setNotice={setNotice}
            onChange={creating ? () => setTarget(null) : undefined}
            onSaved={(text, again) => {
              onSaved(text)
              if (!again) return onClose()
              setTarget(null)
              setNotice({
                text: t('goods.recipes.form.createdNext', { name: target.name }),
                failed: false,
              })
            }}
            onCancel={onClose}
          />
        ) : (
          <>
            {notice && <SheetNotice notice={notice} />}
            <ProductPicker
              ingredientTypeId={ingredientTypeId}
              onPick={(picked) => {
                setNotice(null)
                setTarget(picked)
              }}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SheetNotice({ notice }: { notice: Notice }) {
  return (
    <p
      role={notice.failed ? 'alert' : 'status'}
      className={`px-4 text-sm ${notice.failed ? 'text-destructive' : 'text-muted-foreground'}`}
    >
      {notice.text}
    </p>
  )
}

function useDebounced(value: string, delay = 300) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

type PickerRow = { target: RecipeTarget; variantId: string }

// Products to write a recipe for, every selling variant on its own line;
// the ones with an active recipe say so and open it for editing.
function ProductPicker({
  ingredientTypeId,
  onPick,
}: {
  ingredientTypeId: string | null
  onPick: (target: RecipeTarget) => void
}) {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const [term, setTerm] = useState('')
  const search = useDebounced(term.trim())
  const products = useQuery({
    queryKey: goodsKey(storeId, 'recipe-products', search, ingredientTypeId),
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const params = {
        expand: ['variants', 'default_variant'],
        sort: 'name',
        limit: PICKER_LIMIT,
        ...(search ? { search_with_barcode: search } : {}),
        // Ingredients are what recipes use, not what they make. The group
        // keeps products without a type, which a plain `not_eq` would drop.
        ...(ingredientTypeId
          ? {
              'q[g][0][m]': 'or',
              'q[g][0][product_type_id_null]': '1',
              'q[g][0][product_type_id_not_eq]': ingredientTypeId,
            }
          : {}),
      } as ProductListParams
      const { data } = await adminClient.products.list(params)
      return data.flatMap((product) =>
        sellingVariants(product as unknown as ProductSlice).map(
          (variant): PickerRow => ({
            variantId: variant.id,
            target: {
              ref: { variant_id: variant.id },
              name: product.name,
              detail: variant.options_text?.trim() || null,
              sku: variant.sku,
              productId: product.id,
              costPrice: variant.cost_price,
            },
          }),
        ),
      )
    },
  })
  const rows = products.data ?? []
  const ids = rows.map((row) => row.variantId)
  const marks = useQuery({
    queryKey: posKey(storeId, 'goods', 'recipes', 'marks', ids),
    enabled: ids.length > 0,
    queryFn: async () =>
      new Set(
        (await readRecipeList({ variant_ids: ids.join(','), limit: 100 })).data.map(
          (row) => row.owner_id,
        ),
      ),
  })
  return (
    <div className="space-y-3 px-4 pb-4">
      <SearchInput
        value={term}
        onValueChange={setTerm}
        placeholder={t('goods.recipes.form.productSearch')}
        aria-label={t('goods.recipes.form.productSearch')}
        clearLabel={t('goods.recipes.clearSearch')}
        className="h-[2.125rem]"
      />
      {products.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {describeFailure(products.error, t)}
        </p>
      ) : products.isPending ? (
        <p className="text-sm text-muted-foreground">{t('waiting')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('goods.recipes.form.noProducts')}</p>
      ) : (
        <ul className="divide-y rounded-md border" aria-label={t('goods.recipes.form.product')}>
          {rows.map((row) => {
            const has = marks.data?.has(row.variantId) === true
            const label = [row.target.name, row.target.detail].filter(Boolean).join(' · ')
            return (
              <li key={row.variantId} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{label}</p>
                  {row.target.sku && (
                    <p className="text-xs text-muted-foreground">
                      {t('goods.recipes.sku', { sku: row.target.sku })}
                    </p>
                  )}
                </div>
                {has && <Badge variant="secondary">{t('goods.recipes.form.hasRecipe')}</Badge>}
                <Button
                  type="button"
                  size="sm"
                  variant={has ? 'outline' : 'default'}
                  aria-label={`${t(has ? 'goods.recipes.form.edit' : 'goods.recipes.form.pick')} ${label}`}
                  onClick={() => onPick(row.target)}
                >
                  {t(has ? 'goods.recipes.form.edit' : 'goods.recipes.form.pick')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function RecipeForm({
  target,
  creating,
  ingredientTypeId,
  ingredientsReadable,
  canWriteCost,
  currency,
  notice,
  setNotice,
  onChange,
  onSaved,
  onCancel,
}: {
  target: RecipeTarget
  creating: boolean
  ingredientTypeId: string | null
  ingredientsReadable: boolean
  canWriteCost: boolean
  currency: string
  notice: Notice | null
  setNotice: (notice: Notice | null) => void
  onChange?: () => void
  onSaved: (text: string, again: boolean) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const recipe = useRecipe(target.ref)
  const units = useQuery({
    queryKey: posKey(storeId, 'units', 'active'),
    queryFn: () => readUnits(false),
  })
  const label = [target.name, target.detail].filter(Boolean).join(' · ')

  const header = (
    <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{t('goods.recipes.form.product')}</p>
        <p className="truncate font-medium" data-recipe-target>
          {label}
        </p>
        {target.sku && (
          <p className="text-xs text-muted-foreground">
            {t('goods.recipes.sku', { sku: target.sku })}
          </p>
        )}
      </div>
      {onChange && (
        <Button type="button" size="sm" variant="outline" onClick={onChange}>
          {t('goods.recipes.form.change')}
        </Button>
      )}
    </div>
  )
  if (recipe.isPending || units.isPending)
    return (
      <div className="space-y-4 px-4">
        {header}
        <PageSkeleton />
      </div>
    )
  if (recipe.isError || units.isError)
    return (
      <div className="space-y-4 px-4">
        {header}
        <p role="alert" className="text-sm text-destructive">
          {recipeFailure(recipe.error ?? units.error, t)}
        </p>
      </div>
    )
  return (
    <RecipeLines
      header={header}
      target={target}
      label={label}
      creating={creating}
      initial={linesFromRecipe(recipe.data.active?.ingredients ?? [])}
      hasRecipe={recipe.data.active !== null}
      savedEstimate={recipe.data.active?.estimated_cost ?? null}
      units={units.data}
      ingredientTypeId={ingredientTypeId}
      ingredientsReadable={ingredientsReadable}
      canWriteCost={canWriteCost}
      currency={currency}
      notice={notice}
      setNotice={setNotice}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  )
}

function RecipeLines({
  header,
  target,
  label,
  creating,
  initial,
  hasRecipe,
  savedEstimate,
  units,
  ingredientTypeId,
  ingredientsReadable,
  canWriteCost,
  currency,
  notice,
  setNotice,
  onSaved,
  onCancel,
}: {
  header: ReactNode
  target: RecipeTarget
  label: string
  creating: boolean
  initial: RecipeLine[]
  hasRecipe: boolean
  savedEstimate: string | null
  units: RecipeUnit[]
  ingredientTypeId: string | null
  ingredientsReadable: boolean
  canWriteCost: boolean
  currency: string
  notice: Notice | null
  setNotice: (notice: Notice | null) => void
  onSaved: (text: string, again: boolean) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const client = useQueryClient()
  const { storeId } = useSession()
  const saver = useConfirmedRecipeSave()
  const variantId = 'variant_id' in target.ref ? target.ref.variant_id : null
  const costable = variantId !== null && target.productId !== null
  const [lines, setLines] = useState<RecipeLine[]>(initial)
  const [followCost, setFollowCost] = useState(
    costable && canWriteCost && followsRecipe(target.costPrice, savedEstimate),
  )
  const [busy, setBusy] = useState(false)
  const ingredients = useGoodsIngredients(ingredientTypeId, ingredientsReadable)
  const total = recipeCost(lines, units)
  const update = (index: number, patch: Partial<RecipeLine>) =>
    setLines((current) => current.map((line, at) => (at === index ? { ...line, ...patch } : line)))

  const failureText = (failure: unknown) =>
    conflictReason(failure) === 'module_disabled'
      ? t('goods.recipes.moduleDisabled')
      : recipeFailure(failure, t)

  // Saves the recipe, then the variant's cost when it follows the recipe.
  // A refused cost update keeps the drawer open on the saved recipe.
  async function submit(again: boolean) {
    setNotice(null)
    if (!linesValid(lines)) {
      setNotice({ text: t('goods.recipes.form.invalid'), failed: true })
      return
    }
    setBusy(true)
    try {
      const saved = await saver.save({ ...target.ref, ingredients: recipeRows(lines) })
      if (saved === null) return
      if (!(followCost && costable && variantId && target.productId))
        return onSaved(t('goods.recipes.saved', { name: label }), again)
      const estimate = saved.active?.estimated_cost ?? null
      const cost = estimate === null ? null : costPriceOf(estimate)
      if (cost === null) return onSaved(t('goods.recipes.savedCostMissing', { name: label }), again)
      try {
        await adminClient.products.variants.update(target.productId, variantId, {
          cost_price: cost,
        })
      } catch (failure) {
        setNotice({
          text: t('goods.recipes.costUpdateFailed', {
            name: label,
            reason: describeFailure(failure, t),
          }),
          failed: true,
        })
        return
      } finally {
        void client.invalidateQueries({ queryKey: ['pos', storeId] })
      }
      onSaved(
        t('goods.recipes.savedWithCost', { name: label, cost: formatMoney(cost, currency) }),
        again,
      )
    } catch (failure) {
      setNotice({ text: failureText(failure), failed: true })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (
      !(await confirm({
        message: t('goods.recipes.deleteConfirm', { name: label }),
        variant: 'destructive',
        confirmLabel: t('goods.recipes.delete'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    setNotice(null)
    setBusy(true)
    try {
      await saver.save({ ...target.ref, ingredients: [] })
      onSaved(t('goods.recipes.deleted', { name: label }), false)
    } catch (failure) {
      setNotice({ text: failureText(failure), failed: true })
    } finally {
      setBusy(false)
    }
  }

  const pending = busy || saver.isPending
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-4 px-4 pb-4">
        {header}
        <section className="space-y-2" aria-label={t('goods.recipes.form.ingredients')}>
          <h3 className="text-sm font-medium">{t('goods.recipes.form.ingredients')}</h3>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('goods.recipes.form.noIngredients')}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">
                      {t('goods.recipes.form.columns.index')}
                    </th>
                    <th className="px-2 py-2 font-medium">
                      {t('goods.recipes.form.columns.ingredient')}
                    </th>
                    <th className="px-2 py-2 font-medium">
                      {t('goods.recipes.form.columns.quantity')}
                    </th>
                    <th className="px-2 py-2 font-medium">
                      {t('goods.recipes.form.columns.unit')}
                    </th>
                    <th className="px-2 py-2 text-right font-medium">
                      {t('goods.recipes.form.columns.cost')}
                    </th>
                    <th className="px-2 py-2">
                      <span className="sr-only">
                        {t('goods.recipes.form.remove', { name: '' })}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.map((line, index) => (
                    <LineRow
                      key={line.variantId}
                      index={index}
                      line={line}
                      units={units}
                      currency={currency}
                      disabled={pending}
                      onChange={(patch) => update(index, patch)}
                      onRemove={() =>
                        setLines((current) => current.filter((_, at) => at !== index))
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <IngredientAdder
            ingredients={ingredients.data ?? []}
            readable={ingredientsReadable}
            loading={ingredients.isPending && ingredientsReadable}
            exclude={new Set([...lines.map((line) => line.variantId), variantId ?? ''])}
            onAdd={(line) => setLines((current) => [...current, line])}
          />
        </section>
        <p className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{t('goods.recipes.form.total')}</span>
          <span className="tabular-nums" data-recipe-total>
            {total === null
              ? t('goods.recipes.form.totalUnknown')
              : formatMoney(amountText(total), currency)}
          </span>
        </p>
        {costable && (
          <CostSwitch
            checked={followCost}
            disabled={!canWriteCost || pending}
            hint={
              canWriteCost
                ? t('goods.recipes.form.costFromIngredientsHint')
                : t('goods.recipes.form.costNeedsWrite')
            }
            current={t('goods.recipes.form.currentCost', {
              cost:
                target.costPrice === null
                  ? t('goods.recipes.form.noCost')
                  : formatMoney(target.costPrice, currency),
            })}
            onChange={setFollowCost}
          />
        )}
        {notice && <SheetNotice notice={notice} />}
      </div>
      <SheetFooter className="mt-auto flex-wrap">
        {hasRecipe && (
          <Button
            type="button"
            variant="outline"
            className="text-destructive sm:mr-auto"
            disabled={pending}
            onClick={() => void remove()}
          >
            <TrashIcon className="size-4" />
            {t('goods.recipes.delete')}
          </Button>
        )}
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          {t('adminCancel')}
        </Button>
        {creating && (
          <Button
            type="button"
            variant="outline"
            disabled={pending || lines.length === 0}
            onClick={() => void submit(true)}
          >
            {t('goods.recipes.form.saveAndNew')}
          </Button>
        )}
        <Button
          type="button"
          disabled={pending || lines.length === 0}
          onClick={() => void submit(false)}
        >
          {t(pending ? 'waiting' : 'save')}
        </Button>
      </SheetFooter>
    </div>
  )
}

function LineRow({
  index,
  line,
  units,
  currency,
  disabled,
  onChange,
  onRemove,
}: {
  index: number
  line: RecipeLine
  units: RecipeUnit[]
  currency: string
  disabled: boolean
  onChange: (patch: Partial<RecipeLine>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const unitId = useId()
  const options = unitsFor(line.baseUnit, units).map((unit) => ({
    value: unit.code,
    label: `${unit.name} (${unit.code})`,
  }))
  if (!options.some((option) => option.value === line.unitCode))
    options.unshift({ value: line.unitCode, label: line.unitCode })
  const cost = lineCost(line, units)
  return (
    <tr data-recipe-line={line.variantId}>
      <td className="px-2 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
      <td className="px-2 py-2">
        <span className="font-medium">{line.name}</span>
        {line.sku && <span className="block text-xs text-muted-foreground">{line.sku}</span>}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8"
            disabled={disabled}
            aria-label={t('goods.recipes.form.decrease', { name: line.name })}
            onClick={() => onChange({ quantity: stepQuantity(line.quantity, -1) })}
          >
            <MinusIcon className="size-4" />
          </Button>
          <Input
            className="h-8 w-20 text-right tabular-nums"
            inputMode="decimal"
            aria-label={t('goods.recipes.form.quantityOf', { name: line.name })}
            value={line.quantity}
            disabled={disabled}
            onChange={(event) => onChange({ quantity: event.target.value.trim() })}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8"
            disabled={disabled}
            aria-label={t('goods.recipes.form.increase', { name: line.name })}
            onClick={() => onChange({ quantity: stepQuantity(line.quantity, 1) })}
          >
            <PlusIcon className="size-4" />
          </Button>
        </div>
      </td>
      <td className="min-w-32 px-2 py-2">
        <label htmlFor={unitId} className="sr-only">
          {t('goods.recipes.form.unitOf', { name: line.name })}
        </label>
        <TopologySelect
          id={unitId}
          value={line.unitCode}
          disabled={disabled}
          options={options}
          onChange={(value) => onChange({ unitCode: value })}
        />
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
        {cost === null ? '—' : formatMoney(amountText(cost), currency)}
      </td>
      <td className="px-2 py-2 text-right">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8"
          disabled={disabled}
          aria-label={t('goods.recipes.form.remove', { name: line.name })}
          onClick={onRemove}
        >
          <TrashIcon className="size-4" />
        </Button>
      </td>
    </tr>
  )
}

// Finds an ingredient by name or code and adds it as a new line.
function IngredientAdder({
  ingredients,
  readable,
  loading,
  exclude,
  onAdd,
}: {
  ingredients: IngredientProduct[]
  readable: boolean
  loading: boolean
  exclude: Set<string>
  onAdd: (line: RecipeLine) => void
}) {
  const { t } = useTranslation()
  const [term, setTerm] = useState('')
  if (!readable)
    return (
      <p className="text-sm text-muted-foreground">
        {t('goods.recipes.form.ingredientsUnreadable')}
      </p>
    )
  const matches = term.trim()
    ? ingredients
        .filter((product) => product.status === 'active' || product.status === 'draft')
        .map((product) => ({ product, variant: ingredientVariant(product) }))
        .filter(
          ({ product, variant }) =>
            variant && !exclude.has(variant.id) && matchesTerm(term, product.name, variant.sku),
        )
        .slice(0, INGREDIENT_MATCHES)
    : []
  return (
    <div className="space-y-2">
      <SearchInput
        value={term}
        onValueChange={setTerm}
        placeholder={t('goods.recipes.form.addIngredientPlaceholder')}
        aria-label={t('goods.recipes.form.addIngredient')}
        clearLabel={t('goods.recipes.clearSearch')}
        className="h-[2.125rem]"
      />
      {term.trim() &&
        (loading ? (
          <p className="text-sm text-muted-foreground">{t('waiting')}</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('goods.recipes.form.noIngredientMatch')}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label={t('goods.recipes.form.addIngredient')}>
            {matches.map(({ product, variant }) =>
              variant ? (
                <li key={variant.id}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onAdd(
                        lineFromIngredient({
                          variant_id: variant.id,
                          name: product.name,
                          sku: variant.sku ?? '',
                          cost_price: variant.cost_price,
                          unit: product.unit,
                        }),
                      )
                      setTerm('')
                    }}
                  >
                    <PlusIcon className="size-4" />
                    {product.name}
                    {variant.sku && <span className="text-muted-foreground">{variant.sku}</span>}
                  </Button>
                </li>
              ) : null,
            )}
          </ul>
        ))}
    </div>
  )
}

function CostSwitch({
  checked,
  disabled,
  hint,
  current,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  hint: string
  current: string
  onChange: (value: boolean) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        aria-label={t('goods.recipes.form.costFromIngredients')}
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">
          {t('goods.recipes.form.costFromIngredients')}
        </label>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint} {current}
        </p>
      </div>
    </div>
  )
}
