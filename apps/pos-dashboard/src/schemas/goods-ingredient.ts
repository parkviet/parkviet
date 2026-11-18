import { z } from 'zod'
import type { IngredientFormValues, ParsedIngredient } from '../lib/goods-ingredients'
import { parseAmount } from './goods-product'

const ERR = 'goods.ingredients.form.errors'
const QUANTITY = /^\d{1,7}$/
// The server takes a threshold up to nine digits; 0 means none.
const THRESHOLD = /^\d{1,9}$/

export function goodsIngredientSchema(currency: string) {
  const money = parseAmount(currency)
  return z
    .object({
      name: z.string().trim().min(1, `${ERR}.name`).max(255, `${ERR}.name`),
      sku: z
        .string()
        .trim()
        .max(64, `${ERR}.sku`)
        .regex(/^[^\s]*$/, `${ERR}.sku`),
      unitCode: z.string().trim().min(1, `${ERR}.unit`),
      costPrice: z.string().refine((v) => v.trim() === '' || money(v) !== null, `${ERR}.cost`),
      alert: z
        .string()
        .trim()
        .refine((v) => v === '' || THRESHOLD.test(v), `${ERR}.alert`),
      openingStock: z.record(
        z.string(),
        z
          .string()
          .trim()
          .refine((v) => v === '' || QUANTITY.test(v), `${ERR}.stock`),
      ),
    })
    .transform(
      (value): ParsedIngredient => ({
        name: value.name,
        sku: value.sku,
        unitCode: value.unitCode,
        costPrice: value.costPrice.trim() === '' ? null : money(value.costPrice),
        alert: value.alert === '' || Number(value.alert) === 0 ? null : Number(value.alert),
        openingStock: Object.fromEntries(
          Object.entries(value.openingStock)
            .filter(([, count]) => count !== '')
            .map(([location, count]) => [location, Number(count)]),
        ),
      }),
    )
}
export type { IngredientFormValues }
