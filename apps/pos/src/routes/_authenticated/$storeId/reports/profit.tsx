import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { ReportsProfitPage } from '../../../../pages/reports-profit'

export const Route = createFileRoute('/_authenticated/$storeId/reports/profit')({
  component: () => (
    <PosRouteGuard page="reports-profit">
      <ReportsProfitPage />
    </PosRouteGuard>
  ),
})
