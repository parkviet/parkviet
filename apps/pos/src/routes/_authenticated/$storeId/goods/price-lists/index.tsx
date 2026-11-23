import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsPriceListsPage } from '../../../../../pages/goods-price-lists'
import { goodsPriceListSearchSchema } from '../../../../../schemas/goods-price-list-search'

export const Route = createFileRoute('/_authenticated/$storeId/goods/price-lists/')({
  validateSearch: goodsPriceListSearchSchema,
  component: () => (
    <PosRouteGuard page="goods-price-lists">
      <GoodsPriceListsPage />
    </PosRouteGuard>
  ),
})
