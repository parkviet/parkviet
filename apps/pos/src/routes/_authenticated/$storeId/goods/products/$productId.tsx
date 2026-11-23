import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsProductFormPage } from '../../../../../pages/goods-product-form'
export const Route = createFileRoute('/_authenticated/$storeId/goods/products/$productId')({
  component: function GoodsProductRoute() {
    const { productId } = Route.useParams()
    return (
      <PosRouteGuard page="goods-products">
        <GoodsProductFormPage key={productId} productId={productId} />
      </PosRouteGuard>
    )
  },
})
