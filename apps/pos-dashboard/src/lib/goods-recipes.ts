// Pure rules of the recipes screen: the ingredient lines being edited, their
// quantity steps, and what a line and the whole recipe cost at today's cost
// prices. The server converts and checks quantities when a recipe is saved
// and answers with its own estimate; the numbers here are the live preview.

// Units as `/pos/units` lists them.
export type RecipeUnit = {
  code: string
  name: string
  base_code: string
  factor_to_base: number
}

export type RecipeLine = {
  variantId: string
  name: string
  sku: string | null
  quantity: string
  unitCode: string
  // The ingredient's stock unit, the unit its stock is counted in.
  baseUnit: string
  // Cost of one stock unit now, or null when the ingredient has none.
  unitCost: string | null
}

// What the server takes: up to four decimals.
export const QUANTITY_PATTERN = /^\d+(\.\d{1,4})?$/
export const validQuantity = (quantity: string) =>
  QUANTITY_PATTERN.test(quantity) && Number(quantity) > 0

const trimDecimal = (value: number, places: number) => {
  const text = value.toFixed(places)
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}

// One −/+ press: a whole unit up or down, never below zero. A blank or
// unreadable quantity counts as zero.
export function stepQuantity(quantity: string, delta: number) {
  const current = QUANTITY_PATTERN.test(quantity) ? Number(quantity) : 0
  return trimDecimal(Math.max(0, current + delta), 4)
}

// Units a line may be entered in: those measuring what its stock unit measures.
export function unitsFor(baseUnit: string, units: readonly RecipeUnit[]) {
  const base = units.find((unit) => unit.code === baseUnit)
  const family = base?.base_code ?? baseUnit
  return units.filter((unit) => unit.base_code === family)
}

// The line's quantity in its stock unit, or null when the quantity or unit
// cannot be read.
export function stockQuantity(line: RecipeLine, units: readonly RecipeUnit[]) {
  if (!validQuantity(line.quantity)) return null
  const unit = units.find((row) => row.code === line.unitCode)
  const base = units.find((row) => row.code === line.baseUnit)
  if (line.unitCode === line.baseUnit) return Number(line.quantity)
  if (!unit || !base || unit.base_code !== base.base_code || base.factor_to_base <= 0) return null
  return (Number(line.quantity) * unit.factor_to_base) / base.factor_to_base
}

const round = (value: number, places: number) => {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

export function lineCost(line: RecipeLine, units: readonly RecipeUnit[]) {
  if (line.unitCost === null) return null
  const quantity = stockQuantity(line, units)
  return quantity === null ? null : round(quantity * Number(line.unitCost), 4)
}

// One unit of what the recipe makes; null while a line has no cost or an
// unreadable quantity, or the recipe has no lines.
export function recipeCost(lines: readonly RecipeLine[], units: readonly RecipeUnit[]) {
  if (lines.length === 0) return null
  let total = 0
  for (const line of lines) {
    const cost = lineCost(line, units)
    if (cost === null) return null
    total += cost
  }
  return round(total, 4)
}

// An ingredient's cost per stock unit from its `cost_price`, which is per
// the unit it is bought in: 1 case = `ratio` stock units.
export function stockUnitCost(
  costPrice: string | null | undefined,
  pack?: { numerator?: number; denominator?: number; packed: boolean },
) {
  if (costPrice == null || !/^\d+(\.\d+)?$/.test(costPrice)) return null
  if (!pack?.packed || !pack.numerator || !pack.denominator) return costPrice
  return trimDecimal((Number(costPrice) * pack.denominator) / pack.numerator, 4)
}

export type IngredientChoice = {
  variant_id: string
  name: string
  sku: string
  cost_price: string | null
  unit: {
    sale_unit: string
    base_unit?: string
    ratio_numerator?: number
    ratio_denominator?: number
  } | null
}

// A new line for a picked ingredient, entered in its stock unit.
export function lineFromIngredient(choice: IngredientChoice): RecipeLine {
  const base = choice.unit?.base_unit ?? choice.unit?.sale_unit ?? 'item'
  const packed = Boolean(choice.unit && choice.unit.sale_unit !== base)
  return {
    variantId: choice.variant_id,
    name: choice.name,
    sku: choice.sku || null,
    quantity: '',
    unitCode: base,
    baseUnit: base,
    unitCost: stockUnitCost(choice.cost_price, {
      numerator: choice.unit?.ratio_numerator,
      denominator: choice.unit?.ratio_denominator,
      packed,
    }),
  }
}

type SavedIngredient = {
  variant_id: string
  name: string | null
  sku: string | null
  options_text: string | null
  quantity: string
  unit_code: string
  base_unit: string
  unit_cost: string | null
}
export const linesFromRecipe = (ingredients: readonly SavedIngredient[]): RecipeLine[] =>
  ingredients.map((row) => ({
    variantId: row.variant_id,
    name: [row.name, row.options_text].filter(Boolean).join(' · ') || row.variant_id,
    sku: row.sku,
    quantity: row.quantity.replace(/\.0+$/, ''),
    unitCode: row.unit_code,
    baseUnit: row.base_unit,
    unitCost: row.unit_cost,
  }))

export const recipeRows = (lines: readonly RecipeLine[]) =>
  lines.map((line) => ({
    variant_id: line.variantId,
    quantity: line.quantity,
    unit_code: line.unitCode,
  }))

export const linesValid = (lines: readonly RecipeLine[]) =>
  lines.length > 0 && lines.every((line) => validQuantity(line.quantity) && line.unitCode !== '')

// A computed amount as a decimal string for display, to two decimals.
export const amountText = (value: number) => trimDecimal(round(value, 2), 2)

// Spree keeps cost prices to two decimals.
export function costPriceOf(estimate: string) {
  if (!/^\d+(\.\d+)?$/.test(estimate)) return null
  return trimDecimal(round(Number(estimate), 2), 2)
}

// Whether the size's cost already follows its recipe (or it has none), so
// "cost from ingredients" starts on.
export function followsRecipe(costPrice: string | null, estimate: string | null) {
  if (costPrice === null || Number(costPrice) === 0) return true
  return estimate !== null && Number(costPrice) === Number(costPriceOf(estimate))
}

export function matchesTerm(term: string, ...fields: (string | null | undefined)[]) {
  const needle = term.trim().toLocaleLowerCase()
  return (
    needle === '' || fields.some((field) => field?.toLocaleLowerCase().includes(needle) === true)
  )
}
