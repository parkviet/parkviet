import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsProductFormPage } from '../../../../../pages/goods-product-form'
export const Route = createFileRoute('/_authenticated/$storeId/goods/products/new')({
  component: () => (
    <PosRouteGuard page="goods-products">
      <GoodsProductFormPage />
    </PosRouteGuard>
  ),
})
