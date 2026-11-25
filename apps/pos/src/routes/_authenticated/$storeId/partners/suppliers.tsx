import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { PartnersSuppliersPage } from '../../../../pages/partners-suppliers'

export const Route = createFileRoute('/_authenticated/$storeId/partners/suppliers')({
  component: () => (
    <PosRouteGuard page="partners-suppliers">
      <PartnersSuppliersPage />
    </PosRouteGuard>
  ),
})
