import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { PartnersCustomersPage } from '../../../../pages/partners-customers'

export const Route = createFileRoute('/_authenticated/$storeId/partners/customers')({
  component: () => (
    <PosRouteGuard page="partners-customers">
      <PartnersCustomersPage />
    </PosRouteGuard>
  ),
})
