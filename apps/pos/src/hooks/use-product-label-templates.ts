import { isProductLabelPaper } from '@shared/product-label/presets'
import type {
  ProductLabelConfig,
  ProductLabelPaper,
} from '@shared/product-label/types'
import { validateProductLabelConfig } from '@shared/product-label/validate'
import { useQuery } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { type ReceiptTemplate, receiptTemplatesKey } from './use-receipt-templates'
import { useSession } from './use-session'

// Product label templates share the print template endpoint
// (`/pos/receipt_templates`, document type `product_label`) and its
// versions, default, limit and audit rules. Their config and paper stocks
// are their own, so they have their own types and list.

type StoredTemplate = Omit<ReceiptTemplate, 'document_type' | 'paper' | 'config'>

export type ProductLabelTemplate = StoredTemplate & {
  document_type: 'product_label'
  paper: ProductLabelPaper
  config: ProductLabelConfig
}

// What the template detail endpoint can return: either kind of template.
export type AnyTemplate = ReceiptTemplate | ProductLabelTemplate

export const isProductLabelTemplate = (
  template: { document_type: string } | null | undefined,
): template is ProductLabelTemplate => template?.document_type === 'product_label'

// A label template read from the server must carry a known stock and a
// config this editor can lay out; anything else is left out of the list.
const readable = (template: { document_type: string; paper: string; config: unknown }) =>
  template.document_type === 'product_label' &&
  isProductLabelPaper(template.paper) &&
  validateProductLabelConfig(template.config).length === 0

export function useProductLabelTemplates(enabled: boolean, includeDisabled = true) {
  const snapshot = useSession()
  return useQuery({
    queryKey: [...receiptTemplatesKey(snapshot.generation), 'label-list', includeDisabled],
    enabled: enabled && snapshot.status === 'authenticated',
    staleTime: 0,
    queryFn: async () => {
      const result = await posRequest<{ data: ProductLabelTemplate[] }>(
        'GET',
        '/pos/receipt_templates',
        {
          params: {
            document_type: 'product_label',
            include_disabled: includeDisabled ? '1' : undefined,
          },
        },
      )
      return result.data.filter(readable)
    },
  })
}

// One template of either kind. Shares its cache entry with
// `useReceiptTemplate`, so the page that picks the editor and the editor
// itself read the template once.
export function useStoredTemplate(id: string, enabled: boolean) {
  const snapshot = useSession()
  return useQuery({
    queryKey: [...receiptTemplatesKey(snapshot.generation), 'detail', id],
    enabled: enabled && snapshot.status === 'authenticated' && id !== '',
    queryFn: async () =>
      (await posRequest<{ data: AnyTemplate }>('GET', `/pos/receipt_templates/${id}`)).data,
  })
}

type Saved = { data: ProductLabelTemplate }

export function createProductLabelTemplate(body: { name: string; paper: ProductLabelPaper }) {
  return posRequest<Saved>('POST', '/pos/receipt_templates', {
    body: { from_default: 'product_label', ...body },
  })
}

export function updateProductLabelTemplate(
  id: string,
  body: {
    expected_version: number
    name: string
    paper: ProductLabelPaper
    config: ProductLabelConfig
  },
) {
  return posRequest<Saved>('PATCH', `/pos/receipt_templates/${id}`, { body })
}

export const duplicateProductLabelTemplate = (id: string) =>
  posRequest<Saved>('POST', `/pos/receipt_templates/${id}/duplicate`, { body: {} })

export const makeDefaultProductLabelTemplate = (id: string) =>
  posRequest<Saved>('POST', `/pos/receipt_templates/${id}/default`, { body: {} })

export const disableProductLabelTemplate = (id: string) =>
  posRequest<Saved>('POST', `/pos/receipt_templates/${id}/disable`, { body: {} })

export const enableProductLabelTemplate = (id: string) =>
  posRequest<Saved>('POST', `/pos/receipt_templates/${id}/enable`, { body: {} })

export const restoreProductLabelTemplate = (id: string, version: number, expectedVersion: number) =>
  posRequest<Saved>('POST', `/pos/receipt_templates/${id}/restore`, {
    body: { version, expected_version: expectedVersion },
  })
