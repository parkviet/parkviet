import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { TaxInfoPage } from '../../../../pages/tax-info'

export const Route = createFileRoute('/_authenticated/$storeId/settings/tax-info')({
  component: () => (
    <PosRouteGuard page="tax-info">
      <TaxInfoPage />
    </PosRouteGuard>
  ),
})
