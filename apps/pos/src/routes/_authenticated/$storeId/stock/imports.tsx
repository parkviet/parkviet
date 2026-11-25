import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { StockDocumentsPage } from '../../../../pages/stock-documents'

export const Route = createFileRoute('/_authenticated/$storeId/stock/imports')({
  component: () => (
    <PosRouteGuard page="stock-imports">
      <StockDocumentsPage kind="import" />
    </PosRouteGuard>
  ),
})
