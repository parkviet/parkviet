import { RECEIPT_DOCUMENT_TYPES } from '@parkviet/pos-shared/receipt-template/types'
import { resourceSearchSchema } from '@spree/dashboard-core'
import { z } from 'zod'
import { RECEIVABLE_STATUSES } from '../hooks/use-debts'
import { ORDER_STATUSES } from '../hooks/use-orders'

const id = z.string().max(64).optional().catch(undefined)

// Single-choice filters of the order history, kept in the URL beside the
// table's own search, date filter and page.
export const orderSearchSchema = resourceSearchSchema.extend({
  status: z.enum(ORDER_STATUSES).optional().catch(undefined),
  registerId: id,
  cashierId: id,
})
export type OrderSearch = z.infer<typeof orderSearchSchema>

export const deliverySearchSchema = resourceSearchSchema.extend({
  status: z.enum(['pending', 'delivered']).optional().catch(undefined),
})
export type DeliverySearch = z.infer<typeof deliverySearchSchema>

// The received funds open in the detail sheet, so a shift-close checklist
// or a shared link can point at one record.
export const fundsSearchSchema = resourceSearchSchema.extend({ fundsId: id })
export type FundsSearch = z.infer<typeof fundsSearchSchema>

// The closed shift whose snapshot is open beside the closure history.
export const closureSearchSchema = resourceSearchSchema.extend({ shiftId: id })
export type ClosureSearch = z.infer<typeof closureSearchSchema>

// The receivables view: the customer whose debts are open beside the list,
// and the order status of the debts list.
export const receivableSearchSchema = resourceSearchSchema.extend({
  accountId: id,
  status: z.enum(RECEIVABLE_STATUSES).optional().catch(undefined),
})
export type ReceivableSearch = z.infer<typeof receivableSearchSchema>

export const receiptTemplateSearchSchema = z.object({
  search: z.string().max(120).optional().catch(undefined),
  type: z.enum(RECEIPT_DOCUMENT_TYPES).optional().catch(undefined),
  paper: z.enum(['58mm', '80mm', 'a4', 'a5', 'a6']).optional().catch(undefined),
  status: z.enum(['active', 'disabled']).optional().catch(undefined),
  // The page's top-level tab; the receipts tab is the default.
  tab: z.enum(['receipts', 'labels']).optional().catch(undefined),
  // The label stock family filter of the labels tab.
  group: z.enum(['roll1', 'roll2', 'roll3', 'a4', 'a5']).optional().catch(undefined),
})
export type ReceiptTemplateSearch = z.infer<typeof receiptTemplateSearchSchema>
