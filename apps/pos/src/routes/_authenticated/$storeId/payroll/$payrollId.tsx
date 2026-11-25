import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { PayrollDetailPage } from '../../../../pages/payroll'

export const Route = createFileRoute('/_authenticated/$storeId/payroll/$payrollId')({
  component: () => (
    <PosRouteGuard page="payroll">
      <PayrollDetailPage payrollId={Route.useParams().payrollId} />
    </PosRouteGuard>
  ),
})
