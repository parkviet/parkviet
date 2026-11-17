import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { StoreInfoPage } from '../../../../pages/store-info'

export const Route = createFileRoute('/_authenticated/$storeId/settings/store-info')({
  component: () => (
    <PosRouteGuard page="store-info">
      <StoreInfoPage />
    </PosRouteGuard>
  ),
})
