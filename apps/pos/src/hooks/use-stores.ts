// Opening another store (server: Spree::Api::V3::Admin::StoresController).
import { i18n, useAuth, useResourceMutation } from '@spree/dashboard-core'
import { useQuery } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { type StoreSummary, withStore } from '../schemas/store'
import { useSession } from './use-session'

/** ISO codes of every country a store can sell from; the page names them. */
export function useCountryCodes() {
  const { storeId } = useSession()
  return useQuery({
    queryKey: posKey(storeId, 'country-codes'),
    queryFn: () =>
      posRequest<{ data: { iso: string }[] }>('GET', '/countries').then((response) =>
        response.data.map((country) => country.iso),
      ),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function useCreateStore() {
  const { user, updateUser } = useAuth()
  return useResourceMutation({
    mutationFn: (body: Record<string, unknown>) =>
      posRequest<StoreSummary>('POST', '/stores', { body }),
    successMessage: i18n.t('stores.created'),
    onSuccess: (created) => updateUser({ stores: withStore(user?.stores ?? [], created) }),
  })
}
