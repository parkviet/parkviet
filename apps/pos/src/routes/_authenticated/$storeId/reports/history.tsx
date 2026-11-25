import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { ReportsHistoryPage } from '../../../../pages/reports-history'

export const Route = createFileRoute('/_authenticated/$storeId/reports/history')({
  component: () => (
    <PosRouteGuard page="reports-history">
      <ReportsHistoryPage />
    </PosRouteGuard>
  ),
})
