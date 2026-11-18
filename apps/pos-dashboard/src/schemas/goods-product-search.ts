import { resourceSearchSchema } from '@spree/dashboard-core'
import { z } from 'zod'

// The product list keeps the shared table's search, filters, columns, page
// and open view (`pos`: on the POS channel, `unpublished`: not on it yet) in
// the URL.
export const GOODS_PRODUCT_VIEWS = ['pos', 'unpublished'] as const
export const goodsProductSearchSchema = resourceSearchSchema.extend({
  view: z.enum(GOODS_PRODUCT_VIEWS).optional().catch(undefined),
})
export type GoodsProductSearch = z.infer<typeof goodsProductSearchSchema>
