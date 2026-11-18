import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { BranchEmenuTab } from '../../../../../pages/branch-emenu'
export const Route = createFileRoute('/_authenticated/$storeId/branches/$branchId/emenu')({
  component: () => (
    <PosRouteGuard page="branch-emenu">
      <BranchEmenuTab />
    </PosRouteGuard>
  ),
})
