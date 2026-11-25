import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { ReportsTransactionPage } from '../../../../pages/reports-transaction'

export const Route = createFileRoute('/_authenticated/$storeId/reports/transaction')({
  component: () => (
    <PosRouteGuard page="reports-transaction">
      <ReportsTransactionPage />
    </PosRouteGuard>
  ),
})
