import { useQuery } from '@tanstack/react-query'
import { posRequest } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

export const TAX_PERIODS = ['month', 'quarter'] as const
export type TaxPeriod = (typeof TAX_PERIODS)[number]
// Fields the declaration needs, in the order the server reports them.
export const TAX_REQUIRED = [
  'taxpayer_name',
  'tax_code',
  'business_address',
  'declaration_period',
  'tax_authority_code',
  'industry_code',
  'business_area_m2',
  'signer_name',
  'head_office_location',
] as const
export type TaxRequiredField = (typeof TAX_REQUIRED)[number]

export type TaxLocation = {
  branch_id: string
  name: string
  code: string
  status: string
  address: string | null
  tax_location_code: string | null
  tax_head_office: boolean
}

export type TaxProfileRecord = {
  id: string | null
  store_info_saved: boolean
  name: string | null
  tax_code: string | null
  province_code: string | null
  ward_code: string | null
  province_name: string | null
  ward_name: string | null
  street: string | null
  description: string | null
  store_code: string | null
  legacy_tax_code: string | null
  declaration_period: TaxPeriod | null
  tax_authority_code: string | null
  business_area_m2: string | null
  industry_code: string | null
  signer_name: string | null
  preparer_name: string | null
  storekeeper_name: string | null
  cashier_name: string | null
  locations: TaxLocation[]
  readiness: { filled: number; total: number; missing: TaxRequiredField[] }
}

export type TaxCatalogItem = { code: string; name: string; group?: string }
export type TaxCatalogList = {
  basis: string
  updated_on: string
  verified: boolean
  items: TaxCatalogItem[]
}
export type TaxCatalog = { tax_authorities: TaxCatalogList; industries: TaxCatalogList }

type Row = Record<string, unknown>
const record = (value: unknown): Row =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Row) : {}
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null
const isRequired = (value: unknown): value is TaxRequiredField =>
  (TAX_REQUIRED as readonly unknown[]).includes(value)

export type TaxReadiness = TaxProfileRecord['readiness']

export function normalizeReadiness(value: unknown): TaxReadiness {
  const readiness = record(value)
  return {
    filled: typeof readiness.filled === 'number' ? readiness.filled : 0,
    total: typeof readiness.total === 'number' ? readiness.total : TAX_REQUIRED.length,
    missing: Array.isArray(readiness.missing) ? readiness.missing.filter(isRequired) : [],
  }
}

export function normalizeTaxProfile(value: unknown): TaxProfileRecord {
  const row = record(value)
  const period = text(row.declaration_period)
  return {
    id: text(row.id),
    store_info_saved: row.store_info_saved === true,
    name: text(row.name),
    tax_code: text(row.tax_code),
    province_code: text(row.province_code),
    ward_code: text(row.ward_code),
    province_name: text(row.province_name),
    ward_name: text(row.ward_name),
    street: text(row.street),
    description: text(row.description),
    store_code: text(row.store_code),
    legacy_tax_code: text(row.legacy_tax_code),
    declaration_period: period === 'month' || period === 'quarter' ? period : null,
    tax_authority_code: text(row.tax_authority_code),
    business_area_m2: text(row.business_area_m2),
    industry_code: text(row.industry_code),
    signer_name: text(row.signer_name),
    preparer_name: text(row.preparer_name),
    storekeeper_name: text(row.storekeeper_name),
    cashier_name: text(row.cashier_name),
    locations: (Array.isArray(row.locations) ? row.locations : []).flatMap((item) => {
      const location = record(item)
      const branchId = text(location.branch_id)
      if (!branchId) return []
      return [
        {
          branch_id: branchId,
          name: text(location.name) ?? branchId,
          code: text(location.code) ?? '',
          status: text(location.status) ?? 'active',
          address: text(location.address),
          tax_location_code: text(location.tax_location_code),
          tax_head_office: location.tax_head_office === true,
        },
      ]
    }),
    readiness: normalizeReadiness(row.readiness),
  }
}

function catalogList(value: unknown): TaxCatalogList {
  const row = record(value)
  return {
    basis: text(row.basis) ?? '',
    updated_on: text(row.updated_on) ?? '',
    verified: row.verified === true,
    items: (Array.isArray(row.items) ? row.items : []).flatMap((item) => {
      const entry = record(item)
      const code = text(entry.code)
      const name = text(entry.name)
      if (!code || !name) return []
      const group = text(entry.group)
      return [group ? { code, name, group } : { code, name }]
    }),
  }
}

export function normalizeTaxCatalog(value: unknown): TaxCatalog {
  const row = record(value)
  return {
    tax_authorities: catalogList(row.tax_authorities),
    industries: catalogList(row.industries),
  }
}

export function useTaxProfile(storeId: string | null, enabled = true) {
  const snapshot = useSession()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'tax-profile', storeId),
    enabled: enabled && snapshot.status === 'authenticated' && Boolean(storeId),
    queryFn: async () =>
      normalizeTaxProfile((await posRequest<{ data?: unknown }>('GET', '/pos/tax_profile')).data),
  })
}

export function useTaxCatalog(enabled = true) {
  const snapshot = useSession()
  return useQuery({
    queryKey: posKey(snapshot.storeId, 'tax-catalog'),
    enabled: enabled && snapshot.status === 'authenticated',
    staleTime: 86_400_000,
    queryFn: async () =>
      normalizeTaxCatalog((await posRequest<{ data?: unknown }>('GET', '/pos/tax_catalog')).data),
  })
}

export async function saveTaxProfile(body: Record<string, unknown>) {
  return normalizeTaxProfile(
    (await posRequest<{ data?: unknown }>('PATCH', '/pos/tax_profile', { body })).data,
  )
}
