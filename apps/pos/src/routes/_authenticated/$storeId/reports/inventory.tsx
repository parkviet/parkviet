import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { ReportsInventoryPage } from '../../../../pages/reports-inventory'

export const Route = createFileRoute('/_authenticated/$storeId/reports/inventory')({
  component: () => (
    <PosRouteGuard page="reports-inventory">
      <ReportsInventoryPage />
    </PosRouteGuard>
  ),
})
