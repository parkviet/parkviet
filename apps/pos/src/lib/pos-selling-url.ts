type SellingLocation = {
  basePath?: string
  origin?: string
}

const currentLocation = (): SellingLocation => ({
  basePath: import.meta.env.BASE_URL,
  origin: globalThis.location?.origin,
})

const cleanBasePath = (value?: string) => (value ?? '/').replace(/\/+$/, '')
const identity = (value: string | null | undefined) =>
  Boolean(value && /^[a-zA-Z0-9_-]+$/.test(value))

// The counter now lives inside the same POS app, so it is always available.
export function posSellingConfigured(): boolean {
  return true
}

// Same-origin URL to the counter's sale screen for this store and branch.
export function posSellingUrl(
  storeId: string | null | undefined,
  branchId?: string | null,
  location: SellingLocation = currentLocation(),
): string | null {
  if (!identity(storeId)) return null
  const prefix = cleanBasePath(location.basePath)
  const path = `${prefix}/${encodeURIComponent(storeId as string)}/sell`
  const params = new URLSearchParams()
  if (identity(branchId)) params.set('branch', branchId as string)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
