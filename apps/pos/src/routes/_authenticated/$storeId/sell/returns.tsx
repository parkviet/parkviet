import { createFileRoute } from '@tanstack/react-router'
import { ReturnExchangePage } from '../../../../counter/pages/return-exchange'

export const Route = createFileRoute('/_authenticated/$storeId/sell/returns')({
  validateSearch: (search: Record<string, unknown>): { orderId?: string; returnId?: string } => {
    const id = (value: unknown) =>
      typeof value === 'string' && /^[\w-]{1,64}$/.test(value) ? value : undefined
    const orderId = id(search.orderId)
    const returnId = id(search.returnId)
    return { ...(orderId ? { orderId } : {}), ...(returnId ? { returnId } : {}) }
  },
  component: ReturnExchangePage,
})
