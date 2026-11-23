import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../../../lib/route-access'
import { TemplateEditorPage } from '../../../../../pages/template-editor-page'
export const Route = createFileRoute(
  '/_authenticated/$storeId/settings/receipt-templates/$templateId',
)({
  component: () => (
    <PosRouteGuard page="receipt-templates">
      <TemplateEditorPage />
    </PosRouteGuard>
  ),
})
