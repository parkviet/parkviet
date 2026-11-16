import { type Overview, parseOverview } from '@parkviet/pos-shared/overview'
import { useQuery } from '@tanstack/react-query'
import { posRequest as request } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

// The period the home page shows: branch business days, and whether the
// period just before is compared.
export type OverviewPeriod = { from: string; to: string; compare: boolean }

// The home page's figures for the branch and period. Every chart widget
// reads this one query, so the page makes a single request per branch,
// period and comparison. A payload the widgets could not draw is a failure.
export function useOverview(branchId: string, period: OverviewPeriod | null, enabled = true) {
  const { storeId, status } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'overview', branchId, period?.from, period?.to, period?.compare),
    enabled: enabled && period !== null && status === 'authenticated',
    // Figures move while the branch sells; a minute old is fresh enough.
    staleTime: 60_000,
    placeholderData: (previous, query) => (query?.queryKey[3] === branchId ? previous : undefined),
    queryFn: async (): Promise<Overview> => {
      if (!period) throw new Error('No period selected.')
      const response = await request<{ data: unknown }>('GET', '/pos/overview', {
        params: {
          branch_id: branchId,
          from: period.from,
          to: period.to,
          compare: period.compare ? '1' : '0',
        },
      })
      return parseOverview(response?.data)
    },
  })
}
