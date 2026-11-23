import { z } from 'zod'
import type { TaxProfileRecord } from '../hooks/use-tax-profile'

// Same rules as the server (EinvoiceSetting::TAX_CODE, TaxProfile and
// BranchInfo); the server stays the authority and maps its own errors.
export const TAX_CODE = /^(\d{10}(-\d{3})?|\d{12})$/
export const LEGACY_TAX_CODE = /^\d{10}(-\d{3})?$/
export const TAX_LOCATION_CODE = /^[0-9A-Za-z-]{1,20}$/
const AREA = /^\d{1,8}(\.\d{1,2})?$/

const optional = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || pattern.test(value), message)
const name = z.string().trim().max(120, 'taxInfo.errorTooLong')

export const taxInfoSchema = z.object({
  name: z.string().trim().min(1, 'taxInfo.errorNameRequired').max(120, 'taxInfo.errorTooLong'),
  tax_code: optional(TAX_CODE, 'taxInfo.errorTaxCode'),
  legacy_tax_code: optional(LEGACY_TAX_CODE, 'taxInfo.errorLegacyTaxCode'),
  store_code: z.string().trim().max(32, 'taxInfo.errorTooLong'),
  description: z.string().max(1000, 'taxInfo.errorTooLong'),
  province_code: z.string(),
  ward_code: z.string(),
  street: z.string().trim().max(200, 'taxInfo.errorTooLong'),
  province_name: z.string(),
  ward_name: z.string(),
  declaration_period: z.enum(['', 'month', 'quarter']),
  tax_authority_code: z.string(),
  business_area_m2: optional(AREA, 'taxInfo.errorArea'),
  industry_code: z.string(),
  signer_name: name,
  preparer_name: name,
  storekeeper_name: name,
  cashier_name: name,
  locations: z.array(
    z.object({
      branch_id: z.string(),
      tax_location_code: optional(TAX_LOCATION_CODE, 'taxInfo.errorLocationCode'),
      tax_head_office: z.boolean(),
    }),
  ),
})
export type TaxInfoValues = z.infer<typeof taxInfoSchema>

export function taxInfoValues(record: TaxProfileRecord): TaxInfoValues {
  return {
    name: record.name ?? '',
    tax_code: record.tax_code ?? '',
    legacy_tax_code: record.legacy_tax_code ?? '',
    store_code: record.store_code ?? '',
    description: record.description ?? '',
    province_code: record.province_code ?? '',
    ward_code: record.ward_code ?? '',
    street: record.street ?? '',
    province_name: record.province_name ?? '',
    ward_name: record.ward_name ?? '',
    declaration_period: record.declaration_period ?? '',
    tax_authority_code: record.tax_authority_code ?? '',
    business_area_m2: record.business_area_m2 ?? '',
    industry_code: record.industry_code ?? '',
    signer_name: record.signer_name ?? '',
    preparer_name: record.preparer_name ?? '',
    storekeeper_name: record.storekeeper_name ?? '',
    cashier_name: record.cashier_name ?? '',
    locations: record.locations.map((location) => ({
      branch_id: location.branch_id,
      tax_location_code: location.tax_location_code ?? '',
      tax_head_office: location.tax_head_office,
    })),
  }
}

const TEXT_FIELDS = [
  'name',
  'tax_code',
  'legacy_tax_code',
  'store_code',
  'description',
  'province_code',
  'ward_code',
  'street',
  'declaration_period',
  'tax_authority_code',
  'business_area_m2',
  'industry_code',
  'signer_name',
  'preparer_name',
  'storekeeper_name',
  'cashier_name',
] as const

// Blank clears a field; the store name is required, as on the store information.
export function taxInfoBody(values: TaxInfoValues): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const field of TEXT_FIELDS) body[field] = values[field].trim() || null
  body.locations = values.locations.map((location) => ({
    branch_id: location.branch_id,
    tax_location_code: location.tax_location_code.trim() || null,
    tax_head_office: location.tax_head_office,
  }))
  return body
}
