import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsPriceListFormPage } from '../../../../../pages/goods-price-list-form'

export const Route = createFileRoute('/_authenticated/$storeId/goods/price-lists/$priceListId')({
  component: function GoodsPriceListRoute() {
    const { priceListId } = Route.useParams()
    return (
      <PosRouteGuard page="goods-price-lists">
        <GoodsPriceListFormPage key={priceListId} priceListId={priceListId} />
      </PosRouteGuard>
    )
  },
})
