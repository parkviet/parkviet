import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { StockDocumentsPage } from '../../../../pages/stock-documents'

export const Route = createFileRoute('/_authenticated/$storeId/stock/opening')({
  component: () => (
    <PosRouteGuard page="stock-opening">
      <StockDocumentsPage kind="opening" />
    </PosRouteGuard>
  ),
})
