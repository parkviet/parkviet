import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { ReportsInventorySummaryPage } from '../../../../pages/reports-inventory-summary'

export const Route = createFileRoute('/_authenticated/$storeId/reports/inventory-summary')({
  component: () => (
    <PosRouteGuard page="reports-inventory-summary">
      <ReportsInventorySummaryPage />
    </PosRouteGuard>
  ),
})
