import { resourceSearchSchema } from '@spree/dashboard-core'
import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsIngredientsPage } from '../../../../../pages/goods-ingredients'

export const Route = createFileRoute('/_authenticated/$storeId/goods/ingredients/')({
  validateSearch: resourceSearchSchema,
  component: () => (
    <PosRouteGuard page="goods-ingredients">
      <GoodsIngredientsPage />
    </PosRouteGuard>
  ),
})
