import { parseMoneyInput, parseVndInput } from '@parkviet/pos-shared/money'
import { z } from 'zod'
import type { GoodsProductFormValues, ParsedGoodsProduct } from '../lib/goods-products'

const ERR = 'goods.products.form.errors'
const QUANTITY = /^\d{1,7}$/
// Amounts as the store's currency is typed: VND as whole digits optionally
// grouped by dots, anything else as a plain decimal.
const amount = (currency: string) => (raw: string) =>
  currency === 'VND' ? parseVndInput(raw) : parseMoneyInput(raw.replace(/\s/g, ''))

export function goodsProductSchema(currency: string) {
  const money = amount(currency)
  return z
    .object({
      name: z.string().trim().min(1, `${ERR}.name`).max(255, `${ERR}.name`),
      kind: z.enum(['goods', 'service']),
      unitCode: z.string().trim().min(1, `${ERR}.unit`),
      sku: z
        .string()
        .trim()
        .max(64, `${ERR}.sku`)
        .regex(/^[^\s]*$/, `${ERR}.sku`),
      barcode: z
        .string()
        .trim()
        .max(64, `${ERR}.barcode`)
        .regex(/^[^\s]*$/, `${ERR}.barcode`),
      description: z.string().trim().max(2000, `${ERR}.description`),
      prepMinutes: z
        .string()
        .trim()
        .refine((v) => v === '' || (/^\d{1,3}$/.test(v) && Number(v) <= 600), `${ERR}.prep`),
      price: z.string().refine((v) => money(v) !== null, `${ERR}.price`),
      costPrice: z.string().refine((v) => v.trim() === '' || money(v) !== null, `${ERR}.cost`),
      taxCategoryId: z.string(),
      trackInventory: z.boolean(),
      openingStock: z.record(
        z.string(),
        z
          .string()
          .trim()
          .refine((v) => v === '' || QUANTITY.test(v), `${ERR}.stock`),
      ),
      categoryIds: z.array(z.string()),
      branchIds: z.array(z.string()),
    })
    .transform(
      (value): ParsedGoodsProduct => ({
        ...value,
        prepMinutes: value.prepMinutes === '' ? null : Number(value.prepMinutes),
        price: money(value.price) ?? '0',
        costPrice: value.costPrice.trim() === '' ? null : money(value.costPrice),
        openingStock: Object.fromEntries(
          Object.entries(value.openingStock)
            .filter(([, count]) => count.trim() !== '')
            .map(([branchId, count]) => [branchId, Number(count)]),
        ),
      }),
    )
}
export type GoodsProductSchema = ReturnType<typeof goodsProductSchema>
export type { GoodsProductFormValues }
