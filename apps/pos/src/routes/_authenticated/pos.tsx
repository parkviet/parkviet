import { useAuth } from '@spree/dashboard-core'
import { Button } from '@spree/dashboard-ui'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { preferredStore } from '../../lib/store-selection'

type CounterEntrySearch = {
  store?: string
  branch?: string
  register?: string
  order?: string
  view?: 'board' | 'order' | 'pay'
}

function parseSearch(search: Record<string, unknown>): CounterEntrySearch {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined)
  const view =
    search.view === 'board' || search.view === 'order' || search.view === 'pay'
      ? search.view
      : undefined
  return {
    store: str(search.store),
    branch: str(search.branch),
    register: str(search.register),
    order: str(search.order),
    view,
  }
}

export const Route = createFileRoute('/_authenticated/pos')({
  validateSearch: parseSearch,
  component: CounterRedirect,
})

function CounterRedirect() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const search = Route.useSearch()
  if (!user) return null
  const storeId =
    (search.store && user.stores?.some((s) => s.id === search.store) ? search.store : null) ??
    preferredStore(user.stores)
  if (storeId) {
    return (
      <Navigate
        to="/$storeId/sell"
        params={{ storeId }}
        search={{
          ...(search.branch ? { branch: search.branch } : {}),
          ...(search.register ? { register: search.register } : {}),
          ...(search.order ? { order: search.order } : {}),
          ...(search.view ? { view: search.view } : {}),
        }}
        replace
      />
    )
  }
  return (
    <main className="p-6">
      <p>{t('posDashboard.noStore')}</p>
      <Button onClick={() => void logout()}>{t('posDashboard.signOut')}</Button>
    </main>
  )
}
