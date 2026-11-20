import { parseMoneyInput, parseVndInput } from '@parkviet/pos-shared/money'
import { z } from 'zod'
import type { GoodsProductFormValues, ParsedGoodsProduct } from '../lib/goods-products'
import {
  combinationCount,
  MAX_ATTRIBUTE_VALUES,
  MAX_ATTRIBUTES,
  MAX_VARIANTS,
  optionSlug,
  sameText,
} from '../lib/goods-variants'

const ERR = 'goods.products.form.errors'
const QUANTITY = /^\d{1,7}$/
const CODE = /^[^\s]*$/
// Amounts as the store's currency is typed: VND as whole digits optionally
// grouped by dots, anything else as a plain decimal. Null when not an amount.
export const parseAmount = (currency: string) => (raw: string) =>
  currency === 'VND' ? parseVndInput(raw) : parseMoneyInput(raw.replace(/\s/g, ''))

const code = (message: string) => z.string().trim().max(64, message).regex(CODE, message)
const openingStock = z.record(
  z.string(),
  z
    .string()
    .trim()
    .refine((v) => v === '' || QUANTITY.test(v), `${ERR}.stock`),
)
const counts = (stock: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(stock)
      .filter(([, count]) => count.trim() !== '')
      .map(([branchId, count]) => [branchId, Number(count)]),
  )

export function goodsProductSchema(currency: string) {
  const money = parseAmount(currency)
  const row = z.object({
    key: z.string(),
    values: z.array(z.string()),
    variantId: z.string().nullable(),
    enabled: z.boolean(),
    sku: code(`${ERR}.sku`),
    barcode: code(`${ERR}.barcode`),
    price: z.string(),
    costPrice: z.string(),
    openingStock,
  })
  return z
    .object({
      name: z.string().trim().min(1, `${ERR}.name`).max(255, `${ERR}.name`),
      kind: z.enum(['goods', 'prepared', 'service']),
      unitCode: z.string().trim().min(1, `${ERR}.unit`),
      sku: code(`${ERR}.sku`),
      barcode: code(`${ERR}.barcode`),
      description: z.string().trim().max(2000, `${ERR}.description`),
      prepMinutes: z
        .string()
        .trim()
        .refine((v) => v === '' || (/^\d{1,3}$/.test(v) && Number(v) <= 600), `${ERR}.prep`),
      price: z.string(),
      costPrice: z.string().refine((v) => v.trim() === '' || money(v) !== null, `${ERR}.cost`),
      taxCategoryId: z.string(),
      trackInventory: z.boolean(),
      openingStock,
      categoryIds: z.array(z.string()),
      branchIds: z.array(z.string()),
      attributes: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
      variants: z.array(row),
      modifierGroupIds: z.array(z.string()),
    })
    .superRefine((value, context) => {
      const issue = (path: (string | number)[], message: string) =>
        context.addIssue({ code: 'custom', path, message: `${ERR}.${message}` })
      if (value.attributes.length === 0) {
        if (money(value.price) === null) issue(['price'], 'price')
        return
      }
      if (value.attributes.length > MAX_ATTRIBUTES) issue(['attributes'], 'attributeCount')
      const names = new Set<string>()
      value.attributes.forEach((attribute, index) => {
        const name = attribute.name.trim()
        if (!name || name.length > 64 || !optionSlug(name))
          issue(['attributes', index, 'name'], 'attributeName')
        else if (names.has(sameText(name)))
          issue(['attributes', index, 'name'], 'attributeDuplicate')
        names.add(sameText(name))
        if (attribute.values.length === 0) issue(['attributes', index, 'values'], 'attributeValues')
        if (attribute.values.length > MAX_ATTRIBUTE_VALUES)
          issue(['attributes', index, 'values'], 'attributeValueCount')
        const seen = new Set<string>()
        for (const raw of attribute.values) {
          const label = raw.trim()
          if (!label || label.length > 64 || !optionSlug(label) || seen.has(sameText(label))) {
            issue(['attributes', index, 'values'], 'attributeValue')
            break
          }
          seen.add(sameText(label))
        }
      })
      if (combinationCount(value.attributes) > MAX_VARIANTS)
        issue(['attributes'], 'tooManyVariants')
      const kept = value.variants.filter((item) => item.enabled)
      if (kept.length === 0) issue(['variants'], 'noVariants')
      const skus = new Map<string, number>()
      value.variants.forEach((item, index) => {
        if (!item.enabled) return
        if (money(item.price) === null) issue(['variants', index, 'price'], 'price')
        if (item.costPrice.trim() !== '' && money(item.costPrice) === null)
          issue(['variants', index, 'costPrice'], 'cost')
        const sku = item.sku.trim()
        if (sku && skus.has(sku)) issue(['variants', index, 'sku'], 'skuDuplicate')
        if (sku) skus.set(sku, index)
      })
    })
    .transform(
      (value): ParsedGoodsProduct => ({
        ...value,
        prepMinutes: value.prepMinutes === '' ? null : Number(value.prepMinutes),
        price: money(value.price) ?? '0',
        costPrice: value.costPrice.trim() === '' ? null : money(value.costPrice),
        openingStock: counts(value.openingStock),
        attributes: value.attributes.map((attribute) => ({
          name: attribute.name.trim(),
          values: attribute.values.map((label) => label.trim()),
        })),
        variants:
          value.attributes.length === 0
            ? []
            : value.variants
                .filter((item) => item.enabled)
                .map((item) => ({
                  key: item.key,
                  values: item.values.map((label) => label.trim()),
                  variantId: item.variantId,
                  sku: item.sku,
                  barcode: item.barcode,
                  price: money(item.price) ?? '0',
                  costPrice: item.costPrice.trim() === '' ? null : money(item.costPrice),
                  openingStock: counts(item.openingStock),
                })),
      }),
    )
}
export type GoodsProductSchema = ReturnType<typeof goodsProductSchema>
export type { GoodsProductFormValues }
