import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../lib/route-access'
import { KitchenBoardPage } from '../../../pages/kitchen-board'
import { kitchenSearchSchema } from '../../../schemas/kitchen-search'

export const Route = createFileRoute('/_authenticated/$storeId/kitchen')({
  validateSearch: kitchenSearchSchema,
  component: () => (
    <PosRouteGuard page="kitchen">
      <KitchenBoardPage />
    </PosRouteGuard>
  ),
})
