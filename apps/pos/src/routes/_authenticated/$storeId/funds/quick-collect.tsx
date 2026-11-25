import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { FundsPage } from '../../../../pages/funds'
import { fundsSearchSchema } from '../../../../schemas/list-search'

export const Route = createFileRoute('/_authenticated/$storeId/funds/quick-collect')({
  validateSearch: fundsSearchSchema,
  component: () => (
    <PosRouteGuard page="funds">
      <FundsPage view="quick-collect" />
    </PosRouteGuard>
  ),
})
