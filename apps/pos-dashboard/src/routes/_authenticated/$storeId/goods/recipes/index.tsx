import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsRecipesPage } from '../../../../../pages/goods-recipes'

export const Route = createFileRoute('/_authenticated/$storeId/goods/recipes/')({
  component: () => (
    <PosRouteGuard page="goods-recipes">
      <GoodsRecipesPage />
    </PosRouteGuard>
  ),
})
