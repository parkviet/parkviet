import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../lib/route-access'
import { StockLedgerPage } from '../../../../pages/stock-ledger'

export const Route = createFileRoute('/_authenticated/$storeId/stock/ledger')({
  component: () => (
    <PosRouteGuard page="stock-ledger">
      <StockLedgerPage />
    </PosRouteGuard>
  ),
})
