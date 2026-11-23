import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsProductsPage } from '../../../../../pages/goods-products'
import { goodsProductSearchSchema } from '../../../../../schemas/goods-product-search'
export const Route = createFileRoute('/_authenticated/$storeId/goods/products/')({
  validateSearch: goodsProductSearchSchema,
  component: () => (
    <PosRouteGuard page="goods-products">
      <GoodsProductsPage />
    </PosRouteGuard>
  ),
})
