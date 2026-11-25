import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { AccountingBooksPage } from '../../../../../pages/accounting-books'

export const Route = createFileRoute('/_authenticated/$storeId/accounting/books/')({
  component: () => (
    <PosRouteGuard page="accounting-books">
      <AccountingBooksPage />
    </PosRouteGuard>
  ),
})
