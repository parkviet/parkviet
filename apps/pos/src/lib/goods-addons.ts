import type { PosMenuModifierGroup, PosMenuOption } from '@shared/types/pos-context'

// An add-on group as the people who manage the menu read it: each option may
// carry its own cost. The counter's menu never has the cost.
export type AddonOption = PosMenuOption & { cost_price?: string | null }
export type AddonGroup = Omit<PosMenuModifierGroup, 'options'> & { options: AddonOption[] }

type Limits = Pick<PosMenuModifierGroup, 'min_select' | 'max_select' | 'allow_quantity'>
type Translate = (key: string, values?: Record<string, number>) => string

// How a group is picked, in words: required or not, then how many, then
// whether one option may be taken several times. The same rule the counter
// and the server apply.
export function describeSelection(group: Limits, t: Translate): string {
  const min = group.min_select
  const max = group.max_select
  const parts = [t(min > 0 ? 'goods.addons.rule.required' : 'goods.addons.rule.optional')]
  if (min > 0 && min === max) parts.push(t('goods.addons.rule.exactly', { count: min }))
  else if (min > 0) parts.push(t('goods.addons.rule.range', { min, max }))
  else parts.push(t('goods.addons.rule.upTo', { count: max }))
  if (group.allow_quantity && max > 1) parts.push(t('goods.addons.rule.quantity'))
  return parts.join(' · ')
}

// The three switches of the form, with the counts they open.
export type AddonRuleForm = {
  required: boolean
  multiple: boolean
  allowQuantity: boolean
  min: string
  max: string
}

export const MAX_SELECT_LIMIT = 50

export function ruleForm(group?: Limits): AddonRuleForm {
  const multiple = (group?.max_select ?? 1) > 1
  return {
    required: (group?.min_select ?? 0) > 0,
    multiple,
    // Quantities only count where more than one pick is allowed.
    allowQuantity: multiple && Boolean(group?.allow_quantity),
    min: String(Math.max(1, group?.min_select ?? 1)),
    max: String(multiple ? (group?.max_select ?? 2) : 2),
  }
}

const wholeNumber = (value: string) => (/^\d{1,3}$/.test(value.trim()) ? Number(value) : null)

// The stored limits of the switches, or null while the counts are invalid.
// One choice is at most one pick; several choices take a maximum of at
// least two (counting quantities when they are allowed), and a required
// group a minimum within it.
export function ruleLimits(form: AddonRuleForm): Limits | null {
  if (!form.multiple)
    return { min_select: form.required ? 1 : 0, max_select: 1, allow_quantity: false }
  const max = wholeNumber(form.max)
  if (max === null || max < 2 || max > MAX_SELECT_LIMIT) return null
  const min = form.required ? wholeNumber(form.min) : 0
  if (min === null || (form.required && min < 1) || min > max) return null
  return { min_select: min, max_select: max, allow_quantity: form.allowQuantity }
}

// One option row of the form. `costKnown` is false for an option read
// without its cost, so saving leaves the stored cost alone.
export type OptionDraft = {
  key: string
  id?: string
  name: string
  price: string
  cost: string
  costKnown: boolean
  inStock: boolean
  defaultSelected: boolean
}

const plain = (amount: string) => amount.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')

export function optionDrafts(group?: AddonGroup): OptionDraft[] {
  return (group?.options ?? []).map((option) => ({
    key: option.id,
    id: option.id,
    name: option.name,
    price: plain(option.price_delta),
    cost: option.cost_price ? plain(option.cost_price) : '',
    costKnown: option.cost_price !== undefined,
    inStock: option.active,
    defaultSelected: option.default_selected,
  }))
}

export const blankOption = (key: string): OptionDraft => ({
  key,
  name: '',
  price: '0',
  cost: '',
  costKnown: true,
  inStock: true,
  defaultSelected: false,
})

const MONEY = /^\d{1,8}(\.\d{1,2})?$/
export const validMoney = (value: string, optional = false) =>
  optional && value.trim() === '' ? true : MONEY.test(value.trim())

export type OptionProblem = 'name' | 'price' | 'cost' | null

export function optionProblem(option: OptionDraft): OptionProblem {
  if (!option.name.trim()) return 'name'
  if (!validMoney(option.price)) return 'price'
  if (!validMoney(option.cost, true)) return 'cost'
  return null
}

// More options picked by default than the group allows would be refused
// at the counter, and an option out of stock is never picked by default.
export function defaultsFit(options: OptionDraft[], limits: Limits): boolean {
  const defaults = options.filter((option) => option.defaultSelected && option.inStock).length
  return defaults <= limits.max_select
}

// The option list the group endpoint takes, in the order shown.
export function optionRows(options: OptionDraft[]) {
  return options.map((option, position) => ({
    ...(option.id ? { id: option.id } : {}),
    name: option.name.trim(),
    price_delta: option.price.trim(),
    ...(option.costKnown ? { cost_price: option.cost.trim() || null } : {}),
    active: option.inStock,
    default_selected: option.defaultSelected && option.inStock,
    position,
  }))
}

// The list with one row moved to `to`, or null when nothing moves.
export function moveRow<T>(rows: readonly T[], from: number, to: number): T[] | null {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return null
  const next = [...rows]
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}

// Prepared products a group is offered on, keyed by product. A combo lists
// its contents instead.
export type AddonProduct = {
  product_id: string
  name: string
  kind: string
  modifier_group_ids: string[]
}

export const appliedItems = (items: readonly AddonProduct[], groupId: string) =>
  items.filter((item) => item.modifier_group_ids.includes(groupId))

// The products whose group list changes so that exactly `chosen` (product
// ids) offer the group; each keeps its other groups in their order.
export function membershipWrites(
  items: readonly AddonProduct[],
  groupId: string,
  chosen: ReadonlySet<string>,
): { product_id: string; modifier_group_ids: string[] }[] {
  return items.flatMap((item) => {
    if (item.kind === 'combo') return []
    const has = item.modifier_group_ids.includes(groupId)
    const wants = chosen.has(item.product_id)
    if (has === wants) return []
    return [
      {
        product_id: item.product_id,
        modifier_group_ids: wants
          ? [...item.modifier_group_ids, groupId]
          : item.modifier_group_ids.filter((id) => id !== groupId),
      },
    ]
  })
}
