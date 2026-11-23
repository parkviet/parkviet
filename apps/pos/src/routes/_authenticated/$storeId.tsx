import {
  AppShell,
  AppShellProvider,
  adminClient,
  PermissionProvider,
  StoreProvider,
  useAuth,
} from '@spree/dashboard-core'
import { createFileRoute, Outlet, retainSearchParams, useRouterState } from '@tanstack/react-router'
import { useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PosCounterLink } from '../../components/pos-counter-link'
import { syncCounterSession } from '../../counter/lib/app-session'
import { PosSessionContext, useCreatePosSession } from '../../hooks/use-pos-session'
import { setActiveStoreId } from '../../lib/active-store'
import { isSettingsRailPath } from '../../lib/settings-area'
import { rememberStore } from '../../lib/store-selection'
import { PosNavigation } from '../../nav'

function isCounterPath(pathname: string, storeId: string): boolean {
  const clean = pathname.replace(/\/+$/, '')
  const needle = `/${storeId}/sell`
  return clean.endsWith(needle) || clean.includes(`${needle}/`)
}

export const Route = createFileRoute('/_authenticated/$storeId')({
  validateSearch: (search: Record<string, unknown>): { branch?: string; register?: string } => ({
    branch: typeof search.branch === 'string' ? search.branch : undefined,
    register: typeof search.register === 'string' ? search.register : undefined,
  }),
  search: { middlewares: [retainSearchParams(['branch', 'register'])] },
  beforeLoad: ({ params }) => {
    adminClient.setStore(params.storeId)
    setActiveStoreId(params.storeId)
    rememberStore(params.storeId)
  },
  component: StoreLayout,
})

function CounterSessionSync({ storeId }: { storeId: string }) {
  const { isAuthenticated, user, logout } = useAuth()
  useLayoutEffect(() => {
    syncCounterSession({
      authenticated: isAuthenticated,
      email: user?.email,
      name: user?.full_name ?? user?.email,
      stores: (user?.stores ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
      })),
      storeId,
      logout,
    })
  }, [isAuthenticated, user, storeId, logout])
  return null
}

function StoreLayout() {
  const { storeId } = Route.useParams()
  const path = useRouterState({ select: (state) => state.location.pathname })
  const inCounter = isCounterPath(path, storeId)
  return (
    <StoreProvider storeId={storeId}>
      <PermissionProvider>
        <CounterSessionSync storeId={storeId} />
        {inCounter ? <Outlet /> : <PosAdminShell key={storeId} />}
      </PermissionProvider>
    </StoreProvider>
  )
}

function PosAdminShell() {
  const { t } = useTranslation()
  const value = useCreatePosSession()
  const path = useRouterState({ select: (state) => state.location.pathname })
  const inSettings = isSettingsRailPath(path)
  return (
    <PosSessionContext.Provider value={value}>
      <PosNavigation />
      <PosCounterLink />
      <AppShellProvider>
        <AppShell
          inSettings={inSettings}
          uiLocales={[
            { code: 'vi', name: 'Tiếng Việt' },
            { code: 'en', name: 'English' },
          ]}
        >
          {value.context.data?.sales_channel &&
            value.context.data.sales_channel.status !== 'active' && (
              <p role="status" className="px-4 pt-4 text-destructive">
                {t(
                  value.context.data.sales_channel.status === 'missing'
                    ? 'pos_channel_missing'
                    : 'pos_channel_inactive',
                )}
              </p>
            )}
          <Outlet />
        </AppShell>
      </AppShellProvider>
    </PosSessionContext.Provider>
  )
}
