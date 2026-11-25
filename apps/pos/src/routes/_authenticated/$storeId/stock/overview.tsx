import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { StockOverviewPage } from '../../../../pages/stock-overview'

export const Route = createFileRoute('/_authenticated/$storeId/stock/overview')({
  component: () => (
    <PosRouteGuard page="stock-overview">
      <StockOverviewPage />
    </PosRouteGuard>
  ),
})
