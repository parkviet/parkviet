import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { GoodsBarcodeLabelsPage } from '../../../../../pages/goods-barcode-labels'

export const Route = createFileRoute('/_authenticated/$storeId/goods/barcode-labels/')({
  component: () => (
    <PosRouteGuard page="goods-barcode-labels">
      <GoodsBarcodeLabelsPage />
    </PosRouteGuard>
  ),
})
