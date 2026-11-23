import { describe, expect, it } from 'vitest'
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
  stockQuantity,
  stockUnitCost,
  unitsFor,
  validQuantity,
} from './goods-recipes'

const units: RecipeUnit[] = [
  { code: 'g', name: 'Gram', base_code: 'g', factor_to_base: 1 },
  { code: 'kg', name: 'Kilogram', base_code: 'g', factor_to_base: 1000 },
  { code: 'ml', name: 'Mililit', base_code: 'ml', factor_to_base: 1 },
  { code: 'l', name: 'Lít', base_code: 'ml', factor_to_base: 1000 },
  { code: 'item', name: 'Cái', base_code: 'item', factor_to_base: 1 },
]
const line = (patch: Partial<RecipeLine> = {}): RecipeLine => ({
  variantId: 'variant_milk',
  name: 'Sữa tươi',
  sku: 'NL000001',
  quantity: '150',
  unitCode: 'ml',
  baseUnit: 'ml',
  unitCost: '40',
  ...patch,
})

describe('recipe quantities', () => {
  it('accepts positive quantities with at most four decimals', () => {
    expect(validQuantity('0.25')).toBe(true)
    expect(validQuantity('12.3456')).toBe(true)
    expect(validQuantity('0')).toBe(false)
    expect(validQuantity('1.23456')).toBe(false)
    expect(validQuantity('')).toBe(false)
    expect(validQuantity('-1')).toBe(false)
  })

  it('steps a whole unit up or down and never below zero', () => {
    expect(stepQuantity('', 1)).toBe('1')
    expect(stepQuantity('150', 1)).toBe('151')
    expect(stepQuantity('0.5', -1)).toBe('0')
    expect(stepQuantity('2.25', 1)).toBe('3.25')
    expect(stepQuantity('abc', -1)).toBe('0')
  })

  it('offers the units that measure what the stock unit measures', () => {
    expect(unitsFor('ml', units).map((unit) => unit.code)).toEqual(['ml', 'l'])
    expect(unitsFor('kg', units).map((unit) => unit.code)).toEqual(['g', 'kg'])
    expect(unitsFor('chai', units)).toEqual([])
  })

  it('converts a quantity into the stock unit', () => {
    expect(stockQuantity(line({ quantity: '0.2', unitCode: 'l' }), units)).toBe(200)
    expect(stockQuantity(line({ quantity: '5', unitCode: 'g' }), units)).toBeNull()
    expect(stockQuantity(line({ quantity: '' }), units)).toBeNull()
    // A unit the store no longer lists still counts in itself.
    expect(stockQuantity(line({ unitCode: 'chai', baseUnit: 'chai', quantity: '2' }), units)).toBe(
      2,
    )
  })
})

describe('recipe cost', () => {
  it('costs each line and the whole recipe', () => {
    const sugar = line({
      variantId: 'variant_sugar',
      quantity: '0.01',
      unitCode: 'kg',
      baseUnit: 'g',
      unitCost: '17',
    })
    expect(lineCost(line(), units)).toBe(6000)
    expect(lineCost(sugar, units)).toBe(170)
    expect(recipeCost([line(), sugar], units)).toBe(6170)
  })

  it('has no total while a line lacks a cost or a quantity, or without lines', () => {
    expect(recipeCost([line(), line({ variantId: 'x', unitCost: null })], units)).toBeNull()
    expect(recipeCost([line({ quantity: '' })], units)).toBeNull()
    expect(recipeCost([], units)).toBeNull()
  })

  it('reads an ingredient bought in packs per stock unit', () => {
    expect(stockUnitCost('240000', { numerator: 24, denominator: 1, packed: true })).toBe('10000')
    expect(stockUnitCost('12000', { numerator: 24, denominator: 1, packed: false })).toBe('12000')
    expect(stockUnitCost(null)).toBeNull()
    expect(stockUnitCost('abc')).toBeNull()
  })

  it('rounds the estimate to a cost price and formats amounts', () => {
    expect(costPriceOf('6170.0')).toBe('6170')
    expect(costPriceOf('12.3456')).toBe('12.35')
    expect(costPriceOf('x')).toBeNull()
    expect(amountText(1234.5)).toBe('1234.5')
  })

  it('starts following the recipe when the cost is unset or already matches', () => {
    expect(followsRecipe(null, null)).toBe(true)
    expect(followsRecipe('0', '5000.0')).toBe(true)
    expect(followsRecipe('5000', '5000.0')).toBe(true)
    expect(followsRecipe('4000', '5000.0')).toBe(false)
    expect(followsRecipe('4000', null)).toBe(false)
  })
})

describe('recipe lines', () => {
  it('starts a picked ingredient in its stock unit', () => {
    expect(
      lineFromIngredient({
        variant_id: 'variant_beer',
        name: 'Bia',
        sku: 'NL000002',
        cost_price: '240000',
        unit: { sale_unit: 'thung', base_unit: 'chai', ratio_numerator: 24, ratio_denominator: 1 },
      }),
    ).toEqual({
      variantId: 'variant_beer',
      name: 'Bia',
      sku: 'NL000002',
      quantity: '',
      unitCode: 'chai',
      baseUnit: 'chai',
      unitCost: '10000',
    })
    expect(
      lineFromIngredient({ variant_id: 'v', name: 'Đá', sku: '', cost_price: null, unit: null }),
    ).toMatchObject({ unitCode: 'item', baseUnit: 'item', sku: null, unitCost: null })
  })

  it('reads saved ingredients and sends rows back', () => {
    const lines = linesFromRecipe([
      {
        variant_id: 'variant_milk',
        name: 'Sữa tươi',
        sku: 'NL000001',
        options_text: null,
        quantity: '0.2',
        unit_code: 'l',
        base_unit: 'ml',
        unit_cost: '40.0',
      },
      {
        variant_id: 'variant_tea',
        name: 'Trà',
        sku: null,
        options_text: 'Gói 500g',
        quantity: '10.0',
        unit_code: 'g',
        base_unit: 'g',
        unit_cost: null,
      },
    ])
    expect(lines.map((row) => [row.name, row.quantity])).toEqual([
      ['Sữa tươi', '0.2'],
      ['Trà · Gói 500g', '10'],
    ])
    expect(recipeRows(lines)).toEqual([
      { variant_id: 'variant_milk', quantity: '0.2', unit_code: 'l' },
      { variant_id: 'variant_tea', quantity: '10', unit_code: 'g' },
    ])
    expect(linesValid(lines)).toBe(true)
    expect(linesValid([])).toBe(false)
    expect(linesValid([line({ quantity: '0' })])).toBe(false)
  })

  it('matches a term in any field, ignoring case', () => {
    expect(matchesTerm('sữa', 'Sữa tươi', 'NL1')).toBe(true)
    expect(matchesTerm('nl1', 'Sữa tươi', 'NL1')).toBe(true)
    expect(matchesTerm('đường', 'Sữa tươi', null)).toBe(false)
    expect(matchesTerm('  ', 'x')).toBe(true)
  })
})
