import { resourceSearchSchema } from '@spree/dashboard-core'
import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { StoresPage } from '../../../../pages/stores'

export const Route = createFileRoute('/_authenticated/$storeId/settings/stores')({
  validateSearch: resourceSearchSchema,
  component: () => (
    <PosRouteGuard page="stores">
      <StoresPage />
    </PosRouteGuard>
  ),
})
