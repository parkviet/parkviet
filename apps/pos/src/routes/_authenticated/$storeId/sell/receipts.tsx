import { createFileRoute } from '@tanstack/react-router'
import { ReceiptPage } from '../../../../counter/pages/receipt'

export const Route = createFileRoute('/_authenticated/$storeId/sell/receipts')({
  validateSearch: (search: Record<string, unknown>): { source?: string; receiptId?: string } => {
    const id = (value: unknown) =>
      typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : undefined
    const source = id(search.source)
    const receiptId = id(search.receiptId)
    return { ...(source ? { source } : {}), ...(receiptId ? { receiptId } : {}) }
  },
  component: ReceiptPage,
})
