import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { TaxDeclarationsPage } from '../../../../../pages/tax-declarations'

export const Route = createFileRoute('/_authenticated/$storeId/accounting/declarations/pit')({
  component: () => (
    <PosRouteGuard page="tax-declarations-pit">
      <TaxDeclarationsPage group="pit" />
    </PosRouteGuard>
  ),
})
