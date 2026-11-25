import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { ReportsOverviewPage } from '../../../../pages/reports-overview'

export const Route = createFileRoute('/_authenticated/$storeId/reports/overview')({
  component: () => (
    <PosRouteGuard page="reports-overview">
      <ReportsOverviewPage />
    </PosRouteGuard>
  ),
})
