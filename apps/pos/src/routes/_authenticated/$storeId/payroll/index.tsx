import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { PayrollListPage } from '../../../../pages/payroll'

export const Route = createFileRoute('/_authenticated/$storeId/payroll/')({
  component: () => (
    <PosRouteGuard page="payroll">
      <PayrollListPage />
    </PosRouteGuard>
  ),
})
