import { useParams } from '@tanstack/react-router'
import { usePosContext } from '../hooks/use-pos-context'
import { isProductLabelTemplate, useStoredTemplate } from '../hooks/use-product-label-templates'
import { ProductLabelEditorPage } from './product-label-editor'
import { ReceiptTemplateEditorPage } from './receipt-template-editor'

// One address for every kind of template: a product label opens its own
// editor, everything else the receipt template editor. Both read the
// template through the same cached query, so it is fetched once.
export function TemplateEditorPage() {
  const context = usePosContext()
  const templateId = useParams({ strict: false }).templateId ?? ''
  const query = useStoredTemplate(templateId, context.data?.administration?.read === true)
  return isProductLabelTemplate(query.data) ? (
    <ProductLabelEditorPage />
  ) : (
    <ReceiptTemplateEditorPage />
  )
}
