import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { TaxConfigPage } from '../../../../pages/tax-config'

export const Route = createFileRoute('/_authenticated/$storeId/settings/tax')({
  component: () => (
    <PosRouteGuard page="tax">
      <TaxConfigPage />
    </PosRouteGuard>
  ),
})
