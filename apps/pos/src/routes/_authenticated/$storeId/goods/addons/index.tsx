import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsAddonsPage } from '../../../../../pages/goods-addons'

export const Route = createFileRoute('/_authenticated/$storeId/goods/addons/')({
  component: () => (
    <PosRouteGuard page="goods-addons">
      <GoodsAddonsPage />
    </PosRouteGuard>
  ),
})
