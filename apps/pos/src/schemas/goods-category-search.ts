import { resourceSearchSchema } from '@spree/dashboard-core'
import { z } from 'zod'

// The categories page keeps the shared table's search, sort and page, and
// whether it shows a list or a grid, in the URL.
export const GOODS_CATEGORY_LAYOUTS = ['list', 'grid'] as const
export type GoodsCategoryLayout = (typeof GOODS_CATEGORY_LAYOUTS)[number]
export const goodsCategorySearchSchema = resourceSearchSchema.extend({
  layout: z.enum(GOODS_CATEGORY_LAYOUTS).optional().catch(undefined),
})
