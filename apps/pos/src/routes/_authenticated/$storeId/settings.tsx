import { SettingsContainer } from '@spree/dashboard-core'
import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { isSettingsRailPath } from '../../../lib/settings-area'

export const Route = createFileRoute('/_authenticated/$storeId/settings')({
  component: SettingsLayout,
})

// Mirrors the admin's settings layout: rail pages (setup, einvoice, system)
// get this container because the shell renders them bare, while the
// Thiết lập pages (store-info, tax, templates) keep the shell's own
// container — wrapping them here too would double the padding.
function SettingsLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  if (!isSettingsRailPath(pathname)) return <Outlet />
  return (
    <SettingsContainer>
      <Outlet />
    </SettingsContainer>
  )
}
