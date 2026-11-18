import { formatMoney } from '@parkviet/pos-shared/money'
import { conflictReason, describeFailure } from '@parkviet/pos-shared/request-failure'
import {
  Badge,
  Button,
  DialogBody,
  DialogFooter,
  SearchInput,
  Switch,
} from '@spree/dashboard-ui'
import { GripVerticalIcon, MoveDownIcon, MoveUpIcon, Trash2Icon } from '@spree/dashboard-ui/icons'
import { type PointerEvent, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMenuItems, useMenuWrite } from '../hooks/use-menu-admin'
import {
  type AddonGroup,
  type AddonRuleForm,
  appliedItems,
  blankOption,
  defaultsFit,
  describeSelection,
  MAX_SELECT_LIMIT,
  membershipWrites,
  moveRow,
  type OptionDraft,
  optionDrafts,
  optionProblem,
  optionRows,
  ruleForm,
  ruleLimits,
} from '../lib/goods-addons'
import { type ProductHit, ProductSearch } from './product-search'
import { ModelCheck } from './setup/model-ui'
import { TopologyDialog } from './topology-dialog'
import { Input, TopologyField } from './topology-fields'

// Creates or edits one add-on group: its options in order (price, own cost,
// in stock), the three switches that set how the counter lets it be picked,
// and the menu items that offer it. The menu screen and the goods add-on
// screen open this same dialog.
export function AddonGroupDialog({
  group,
  branchId,
  onSaved,
  onClose,
}: {
  group?: AddonGroup
  // The branch whose catalogue the product search reads.
  branchId: string | null
  onSaved: (name: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const items = useMenuItems(true)
  const write = useMenuWrite()
  const [name, setName] = useState(group?.name ?? '')
  const [rule, setRule] = useState<AddonRuleForm>(() => ruleForm(group))
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    group ? optionDrafts(group) : [blankOption('new-0')],
  )
  const nextKey = useRef(0)
  const [chosen, setChosen] = useState<Set<string> | null>(null)
  const [pending, setPending] = useState<ProductHit[]>([])
  // Set once the group exists, so a retry after a failed later step updates it.
  const [savedId, setSavedId] = useState(group?.id ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(false)

  const menuItems = items.data ?? []
  const offered = menuItems.filter((item) => item.kind !== 'combo')
  const applied =
    chosen ?? new Set(savedId ? appliedItems(menuItems, savedId).map((item) => item.id) : [])
  const limits = ruleLimits(rule)
  const problems = options.map(optionProblem)
  const valid =
    name.trim() !== '' &&
    limits !== null &&
    options.length > 0 &&
    problems.every((problem) => problem === null) &&
    defaultsFit(options, limits)

  const updateRule = (change: Partial<AddonRuleForm>) =>
    setRule((current) => ({ ...current, ...change }))
  const update = (key: string, change: Partial<OptionDraft>) =>
    setOptions((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)))
  const toggle = (id: string, on: boolean) => {
    const next = new Set(applied)
    if (on) next.add(id)
    else next.delete(id)
    setChosen(next)
  }
  const pick = (hit: ProductHit) => {
    const item = menuItems.find((row) => row.product_id === hit.productId)
    if (item) {
      if (item.kind !== 'combo') toggle(item.id, true)
      return
    }
    setPending((current) =>
      current.some((row) => row.productId === hit.productId) ? current : [...current, hit],
    )
  }

  async function save() {
    setChecked(true)
    if (!valid || !limits) return
    setBusy(true)
    setError('')
    try {
      const body = { name: name.trim(), ...limits, options: optionRows(options) }
      const saved = (await write.mutateAsync({
        method: savedId ? 'PATCH' : 'POST',
        path: `/pos/modifier_groups${savedId ? `/${savedId}` : ''}`,
        body,
      })) as { data?: { id?: string } }
      const id = saved.data?.id ?? savedId
      if (!id) throw new Error('missing group id')
      setSavedId(id)
      setChosen(applied)
      for (const change of membershipWrites(menuItems, id, applied))
        await write.mutateAsync({
          method: 'PATCH',
          path: `/pos/menu_items/${change.id}`,
          body: { modifier_group_ids: change.modifier_group_ids },
        })
      for (const hit of pending) {
        const created = (await write.mutateAsync({
          method: 'POST',
          path: '/pos/menu_items',
          body: { product_id: hit.productId, kind: 'single', modifier_group_ids: [id] },
        })) as { data?: { id?: string } }
        const itemId = created.data?.id
        setPending((current) => current.filter((row) => row.productId !== hit.productId))
        if (itemId) setChosen((current) => new Set([...(current ?? applied), itemId]))
      }
      onSaved(body.name)
      onClose()
    } catch (failure) {
      setError(
        conflictReason(failure) === 'module_disabled'
          ? t('goods.addons.moduleDisabled')
          : describeFailure(failure, t),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <TopologyDialog
      title={t(group ? 'goods.addons.editTitle' : 'goods.addons.createTitle')}
      subtitle={group?.name}
      dirty
      busy={busy}
      wide
      onClose={onClose}
    >
      {(close) => (
        <form
          className="flex min-h-0 flex-col"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <DialogBody className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 space-y-5">
              <TopologyField
                label={t('goods.addons.name')}
                error={checked && !name.trim() ? t('goods.addons.nameRequired') : undefined}
              >
                {(id) => (
                  <Input
                    id={id}
                    value={name}
                    maxLength={80}
                    aria-invalid={checked && !name.trim()}
                    onChange={(event) => setName(event.target.value)}
                  />
                )}
              </TopologyField>
              <RuleSwitches
                rule={rule}
                invalid={checked && limits === null}
                onChange={updateRule}
              />
              <OptionList
                options={options}
                problems={checked ? problems : options.map(() => null)}
                onChange={setOptions}
                onUpdate={update}
                onAdd={() => {
                  nextKey.current += 1
                  setOptions((current) => [...current, blankOption(`new-${nextKey.current}`)])
                }}
              />
              {checked && limits && !defaultsFit(options, limits) && (
                <p role="alert" className="text-sm text-destructive">
                  {t('goods.addons.defaultsTooMany', { count: limits.max_select })}
                </p>
              )}
              {checked && options.length === 0 && (
                <p role="alert" className="text-sm text-destructive">
                  {t('goods.addons.optionsRequired')}
                </p>
              )}
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">{t('goods.addons.products')}</legend>
                <p className="text-sm text-muted-foreground">{t('goods.addons.productsHint')}</p>
                <AppliedProducts
                  items={offered}
                  loading={items.isPending}
                  failed={items.isError ? describeFailure(items.error, t) : ''}
                  applied={applied}
                  onToggle={toggle}
                />
                <ProductSearch
                  branchId={branchId}
                  label={t('goods.addons.addProduct')}
                  onPick={pick}
                />
                {pending.length > 0 && (
                  <ul
                    className="flex flex-wrap gap-2"
                    aria-label={t('goods.addons.pendingProducts')}
                  >
                    {pending.map((hit) => (
                      <li key={hit.productId}>
                        <Badge variant="outline" className="gap-1">
                          {hit.name}
                          <button
                            type="button"
                            aria-label={t('goods.addons.removeProduct', { name: hit.name })}
                            onClick={() =>
                              setPending((current) =>
                                current.filter((row) => row.productId !== hit.productId),
                              )
                            }
                          >
                            ×
                          </button>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <AddonPreview name={name} rule={limits} options={options} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {t(busy ? 'waiting' : 'save')}
            </Button>
          </DialogFooter>
        </form>
      )}
    </TopologyDialog>
  )
}

function SwitchRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        aria-label={label}
        checked={checked}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      </div>
    </div>
  )
}

function RuleSwitches({
  rule,
  invalid,
  onChange,
}: {
  rule: AddonRuleForm
  invalid: boolean
  onChange: (change: Partial<AddonRuleForm>) => void
}) {
  const { t } = useTranslation()
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{t('goods.addons.rules')}</legend>
      <SwitchRow
        label={t('goods.addons.required')}
        hint={t('goods.addons.requiredHint')}
        checked={rule.required}
        onChange={(required) => onChange({ required })}
      />
      <SwitchRow
        label={t('goods.addons.multiple')}
        hint={t('goods.addons.multipleHint')}
        checked={rule.multiple}
        onChange={(multiple) =>
          onChange({ multiple, ...(multiple ? {} : { allowQuantity: false }) })
        }
      />
      <SwitchRow
        label={t('goods.addons.allowQuantity')}
        hint={t(rule.multiple ? 'goods.addons.allowQuantityHint' : 'goods.addons.allowQuantityOff')}
        checked={rule.allowQuantity}
        disabled={!rule.multiple}
        onChange={(allowQuantity) => onChange({ allowQuantity })}
      />
      {rule.multiple && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rule.required && (
            <TopologyField label={t('goods.addons.min')}>
              {(id) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  value={rule.min}
                  aria-invalid={invalid}
                  onChange={(event) => onChange({ min: event.target.value })}
                />
              )}
            </TopologyField>
          )}
          <TopologyField
            label={t(rule.allowQuantity ? 'goods.addons.maxQuantity' : 'goods.addons.max')}
            hint={t('goods.addons.maxHint', { count: MAX_SELECT_LIMIT })}
          >
            {(id, describedBy) => (
              <Input
                id={id}
                inputMode="numeric"
                value={rule.max}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                onChange={(event) => onChange({ max: event.target.value })}
              />
            )}
          </TopologyField>
        </div>
      )}
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {t('goods.addons.limitsInvalid')}
        </p>
      )}
    </fieldset>
  )
}

function OptionList({
  options,
  problems,
  onChange,
  onUpdate,
  onAdd,
}: {
  options: OptionDraft[]
  problems: ReturnType<typeof optionProblem>[]
  onChange: (options: OptionDraft[]) => void
  onUpdate: (key: string, change: Partial<OptionDraft>) => void
  onAdd: () => void
}) {
  const { t } = useTranslation()
  const list = useRef<HTMLOListElement>(null)
  const [drag, setDrag] = useState<{ key: string; target: number } | null>(null)
  const label = (option: OptionDraft, index: number) =>
    option.name.trim() || t('goods.addons.optionNumber', { count: index + 1 })
  const move = (from: number, to: number) => {
    const next = moveRow(options, from, to)
    if (next) onChange(next)
  }
  const dropIndex = (key: string, clientY: number) =>
    Array.from(list.current?.querySelectorAll<HTMLElement>('[data-option-key]') ?? [])
      .filter((row) => row.dataset.optionKey !== key)
      .filter((row) => {
        const box = row.getBoundingClientRect()
        return box.top + box.height / 2 < clientY
      }).length
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, key: string, index: number) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ key, target: index })
  }
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    const target = dropIndex(drag.key, event.clientY)
    if (target !== drag.target) setDrag({ ...drag, target })
  }
  const pointerUp = () => {
    if (!drag) return
    setDrag(null)
    move(
      options.findIndex((row) => row.key === drag.key),
      drag.target,
    )
  }
  const problemText = (problem: ReturnType<typeof optionProblem>) =>
    problem === 'name'
      ? t('goods.addons.optionNameRequired')
      : problem === 'price'
        ? t('goods.addons.priceInvalid')
        : problem === 'cost'
          ? t('goods.addons.costInvalid')
          : ''
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t('goods.addons.options')}</legend>
      <p className="text-sm text-muted-foreground">{t('goods.addons.optionsHint')}</p>
      <ol ref={list} className="space-y-2">
        {options.map((option, index) => {
          const problem = problems[index]
          const name = label(option, index)
          return (
            <li
              key={option.key}
              data-option-key={option.key}
              data-dragging={drag?.key === option.key || undefined}
              aria-label={t('goods.addons.optionPosition', { name, position: index + 1 })}
              className="grid gap-2 rounded-lg border p-3 data-[dragging=true]:opacity-60"
            >
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="mb-1 touch-none cursor-grab"
                  aria-label={t('goods.addons.dragOption', { name })}
                  onPointerDown={(event) => pointerDown(event, option.key, index)}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={() => setDrag(null)}
                >
                  <GripVerticalIcon />
                </Button>
                <div className="min-w-40 flex-1">
                  <TopologyField label={t('goods.addons.optionName')}>
                    {(id) => (
                      <Input
                        id={id}
                        value={option.name}
                        maxLength={80}
                        aria-invalid={problem === 'name'}
                        onChange={(event) => onUpdate(option.key, { name: event.target.value })}
                      />
                    )}
                  </TopologyField>
                </div>
                <div className="w-32">
                  <TopologyField label={t('goods.addons.price')}>
                    {(id) => (
                      <Input
                        id={id}
                        inputMode="decimal"
                        value={option.price}
                        aria-invalid={problem === 'price'}
                        onChange={(event) => onUpdate(option.key, { price: event.target.value })}
                      />
                    )}
                  </TopologyField>
                </div>
                <div className="w-32">
                  <TopologyField label={t('goods.addons.cost')}>
                    {(id) => (
                      <Input
                        id={id}
                        inputMode="decimal"
                        value={option.cost}
                        disabled={!option.costKnown}
                        placeholder={option.costKnown ? '' : '—'}
                        aria-invalid={problem === 'cost'}
                        onChange={(event) => onUpdate(option.key, { cost: event.target.value })}
                      />
                    )}
                  </TopologyField>
                </div>
                <div className="flex gap-1 pb-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    aria-label={t('goods.addons.moveUp', { name })}
                    onClick={() => move(index, index - 1)}
                  >
                    <MoveUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === options.length - 1}
                    aria-label={t('goods.addons.moveDown', { name })}
                    onClick={() => move(index, index + 1)}
                  >
                    <MoveDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('goods.addons.removeOption', { name })}
                    onClick={() => onChange(options.filter((row) => row.key !== option.key))}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 pl-9">
                <CheckRow
                  label={t('goods.addons.inStock')}
                  name={t('goods.addons.inStockOf', { name })}
                  checked={option.inStock}
                  onChange={(inStock) => onUpdate(option.key, { inStock })}
                />
                <CheckRow
                  label={t('goods.addons.defaultSelected')}
                  name={t('goods.addons.defaultSelectedOf', { name })}
                  checked={option.defaultSelected}
                  disabled={!option.inStock}
                  onChange={(defaultSelected) => onUpdate(option.key, { defaultSelected })}
                />
              </div>
              {problem && (
                <p role="alert" className="pl-9 text-sm text-destructive">
                  {problemText(problem)}
                </p>
              )}
            </li>
          )
        })}
      </ol>
      <Button type="button" variant="outline" onClick={onAdd}>
        {t('goods.addons.addOption')}
      </Button>
    </fieldset>
  )
}

// A checkbox named for its row ("Trân châu còn hàng") under a short label.
function CheckRow({
  label,
  name,
  checked,
  disabled,
  onChange,
}: {
  label: string
  name: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <ModelCheck checked={checked} disabled={disabled} name={name} onChange={onChange}>
      <span className="font-normal">{label}</span>
    </ModelCheck>
  )
}

function AppliedProducts({
  items,
  loading,
  failed,
  applied,
  onToggle,
}: {
  items: { id: string; name: string }[]
  loading: boolean
  failed: string
  applied: ReadonlySet<string>
  onToggle: (id: string, on: boolean) => void
}) {
  const { t } = useTranslation()
  const [term, setTerm] = useState('')
  const shown = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase()
    return needle ? items.filter((item) => item.name.toLocaleLowerCase().includes(needle)) : items
  }, [items, term])
  if (failed)
    return (
      <p role="alert" className="text-sm text-destructive">
        {failed}
      </p>
    )
  if (loading)
    return (
      <p role="status" className="text-sm">
        {t('waiting')}
      </p>
    )
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {t('goods.addons.productCount', { count: applied.size })}
      </p>
      {items.length > 0 && (
        <SearchInput
          value={term}
          onValueChange={setTerm}
          placeholder={t('goods.addons.productSearch')}
          aria-label={t('goods.addons.productSearch')}
          clearLabel={t('goods.addons.clearSearch')}
          className="h-[2.125rem] max-w-sm"
        />
      )}
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('goods.addons.noMenuProducts')}</p>
      ) : (
        <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
          {shown.map((item) => (
            <li key={item.id}>
              <CheckRow
                label={item.name}
                name={item.name}
                checked={applied.has(item.id)}
                onChange={(on) => onToggle(item.id, on)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// How the counter shows the group: its rule, then the options in stock with
// what each adds. Options out of stock are left out there.
function AddonPreview({
  name,
  rule,
  options,
}: {
  name: string
  rule: ReturnType<typeof ruleLimits>
  options: OptionDraft[]
}) {
  const { t } = useTranslation()
  const shown = options.filter((option) => option.inStock && option.name.trim())
  const hidden = options.filter((option) => !option.inStock).length
  const single = rule ? rule.max_select === 1 : true
  return (
    <section aria-label={t('goods.addons.preview')} className="space-y-2 self-start">
      <h3 className="text-sm font-medium">{t('goods.addons.preview')}</h3>
      <div className="space-y-3 rounded-lg border bg-muted/40 p-3" data-addon-preview>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-medium">{name.trim() || t('goods.addons.previewUntitled')}</span>
          {rule?.min_select ? (
            <Badge variant="secondary">{t('goods.addons.rule.required')}</Badge>
          ) : null}
        </div>
        {rule && <p className="text-xs text-muted-foreground">{describeSelection(rule, t)}</p>}
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('goods.addons.previewEmpty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {shown.map((option) => (
              <li
                key={option.key}
                className="flex items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`size-3.5 border ${single ? 'rounded-full' : 'rounded-sm'} ${option.defaultSelected ? 'bg-primary' : ''}`}
                  />
                  {option.name}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground tabular-nums">
                  {Number(option.price) > 0 ? `+${formatMoney(option.price)}` : ''}
                  {rule?.allow_quantity && <span aria-hidden>− 0 +</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('goods.addons.previewHidden', { count: hidden })}
          </p>
        )}
      </div>
    </section>
  )
}
