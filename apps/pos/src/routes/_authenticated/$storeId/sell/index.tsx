import { createFileRoute } from '@tanstack/react-router'
import { SalePage } from '../../../../counter/pages/sale'

export const Route = createFileRoute('/_authenticated/$storeId/sell/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { order?: string; view?: 'board' | 'order' | 'pay' } => {
    const order =
      typeof search.order === 'string' && /^[\w-]{1,64}$/.test(search.order)
        ? search.order
        : undefined
    const view =
      search.view === 'board' || search.view === 'order' || search.view === 'pay'
        ? search.view
        : undefined
    return { ...(order ? { order } : {}), ...(view ? { view } : {}) }
  },
  component: SalePage,
})
