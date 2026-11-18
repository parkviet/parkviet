import { resourceSearchSchema } from '@spree/dashboard-core'
import { z } from 'zod'
import { PRICE_LIST_STATES } from '../lib/goods-price-list-form'

// The price lists page keeps the shared table's search, sort and page, and
// the state tab, in the URL.
export const goodsPriceListSearchSchema = resourceSearchSchema.extend({
  state: z.enum(PRICE_LIST_STATES).optional().catch(undefined),
})
