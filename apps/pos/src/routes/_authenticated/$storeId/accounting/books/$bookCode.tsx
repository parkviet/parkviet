import { createFileRoute } from '@tanstack/react-router'
import type { AccountingBookCode } from '../../../../../hooks/use-accounting'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { AccountingBookDetailPage } from '../../../../../pages/accounting-books'

export const Route = createFileRoute('/_authenticated/$storeId/accounting/books/$bookCode')({
  component: () => (
    <PosRouteGuard page="accounting-books">
      <AccountingBookDetailPage bookCode={Route.useParams().bookCode as AccountingBookCode} />
    </PosRouteGuard>
  ),
})
