import type { LabelItem, LabelStoreInfo } from '@parkviet/pos-shared/product-label/render'
import type { PrintJob } from '@parkviet/pos-shared/types/print-adapter'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { type CatalogPage, fetchCatalogPage } from './use-catalog'
import { useSession } from './use-session'

// What the dialog that prints product labels needs from the API: the
// variants of chosen products, and the values a label prints for a variant.

// The server's own limits (`Spree::Pos::ProductLabels::Data`).
export const MAX_LABEL_ITEMS = 200
export const MAX_LABELS_PER_PRINT = 2000
export const MAX_LABEL_COPIES = 999

export type LabelPrintItem = { variantId: string; quantity: number }
export type LabelData = { data: LabelItem[]; store: LabelStoreInfo }
export type CatalogVariant = CatalogPage['data'][number]

// The variants of branch products, from the branch catalog (which lists only
// products sold at the branch). The catalog searches by name, so a product's
// variants are the hits that carry its id.
export async function fetchProductVariants(
  branchId: string,
  products: readonly { id: string; name: string }[],
): Promise<LabelPrintItem[]> {
  const pages = await Promise.all(
    products.map(async (product) =>
      (await fetchCatalogPage(branchId, { q: product.name, limit: 100 })).data.filter(
        (variant) => variant.product_id === product.id,
      ),
    ),
  )
  return pages.flat().map((variant) => ({ variantId: variant.id, quantity: 1 }))
}

// Label values for these variants. Copies do not change them, so the request
// asks for one of each and only a change of variants fetches again.
export function useProductLabelData(branchId: string | null, variantIds: readonly string[]) {
  const snapshot = useSession()
  const ids = [...new Set(variantIds)]
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'product-label-data', branchId, ids),
    enabled:
      snapshot.status === 'authenticated' &&
      Boolean(branchId) &&
      ids.length > 0 &&
      ids.length <= MAX_LABEL_ITEMS,
    placeholderData: keepPreviousData,
    staleTime: 0,
    queryFn: () =>
      posRequest<LabelData>('POST', `/pos/branches/${branchId}/product_labels/data`, {
        body: { items: ids.map((variantId) => ({ variant_id: variantId, quantity: 1 })) },
      }),
  })
}

// Variants to add to the dialog, found by name, SKU or barcode.
export function useLabelVariantSearch(branchId: string | null, query: string) {
  const snapshot = useSession()
  const text = query.trim()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'product-label-variant-search', branchId, text),
    enabled: snapshot.status === 'authenticated' && Boolean(branchId) && text.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () => (await fetchCatalogPage(branchId, { q: text, limit: 8 })).data,
  })
}

export type LabelPrintRequest = {
  templateId: string
  printerId: string
  items: readonly LabelPrintItem[]
  // One key per attempt at the same print, so a retry after a lost answer
  // does not queue the labels twice.
  key: string
}

// Queues the labels on a branch label printer. The server builds the
// document and splits a long list into several jobs.
export function usePrintProductLabels(branchId: string) {
  return useMutation({
    mutationFn: async ({ templateId, printerId, items, key }: LabelPrintRequest) =>
      (
        await posRequest<{ data: { print_jobs: PrintJob[] } }>(
          'POST',
          `/pos/branches/${branchId}/product_labels/print`,
          {
            body: {
              template_id: templateId,
              printer_id: printerId,
              items: items.map((item) => ({ variant_id: item.variantId, quantity: item.quantity })),
            },
            idempotencyKey: key,
          },
        )
      ).data.print_jobs,
  })
}
