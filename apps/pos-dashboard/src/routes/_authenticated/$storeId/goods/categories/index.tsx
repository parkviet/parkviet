import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsCategoriesPage } from '../../../../../pages/goods-categories'
import { goodsCategorySearchSchema } from '../../../../../schemas/goods-category-search'

export const Route = createFileRoute('/_authenticated/$storeId/goods/categories/')({
  validateSearch: goodsCategorySearchSchema,
  component: () => (
    <PosRouteGuard page="goods-categories">
      <GoodsCategoriesPage />
    </PosRouteGuard>
  ),
})
