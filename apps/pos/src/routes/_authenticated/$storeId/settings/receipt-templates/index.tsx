import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { ReceiptTemplatesPage } from '../../../../../pages/receipt-templates'
import { receiptTemplateSearchSchema } from '../../../../../schemas/list-search'
export const Route = createFileRoute('/_authenticated/$storeId/settings/receipt-templates/')({
  validateSearch: receiptTemplateSearchSchema,
  component: () => (
    <PosRouteGuard page="receipt-templates">
      <ReceiptTemplatesPage />
    </PosRouteGuard>
  ),
})
