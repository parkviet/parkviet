import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsPriceListFormPage } from '../../../../../pages/goods-price-list-form'

export const Route = createFileRoute('/_authenticated/$storeId/goods/price-lists/new')({
  component: () => (
    <PosRouteGuard page="goods-price-lists">
      <GoodsPriceListFormPage />
    </PosRouteGuard>
  ),
})
