import { describe, expect, it } from 'vitest'
import { normalizeTaxProfile } from '../hooks/use-tax-profile'
import { TAX_CODE, taxInfoBody, taxInfoSchema, taxInfoValues } from './tax-info'

const record = normalizeTaxProfile({
  name: 'Hộ kinh doanh Hiền',
  tax_code: '001234567890',
  business_area_m2: '32.5',
  declaration_period: 'quarter',
  locations: [
    { branch_id: 'posbranch_1', name: 'A', tax_location_code: '00001', tax_head_office: true },
    { branch_id: 'posbranch_2', name: 'B', tax_location_code: null, tax_head_office: false },
  ],
  readiness: { filled: 3, total: 9, missing: ['industry_code', 'unknown'] },
})

describe('tax info form', () => {
  it('accepts a 10, 13 or 12-digit tax code like the server', () => {
    expect(
      ['0312345678', '0312345678-001', '001234567890'].every((code) => TAX_CODE.test(code)),
    ).toBe(true)
    expect(['031234567', '00123456789', '0312345678-01'].some((code) => TAX_CODE.test(code))).toBe(
      false,
    )
  })

  it('keeps only known readiness fields from the server', () => {
    expect(record.readiness.missing).toEqual(['industry_code'])
  })

  it('sends blanks as null and every location row', () => {
    const values = { ...taxInfoValues(record), signer_name: '  ', business_area_m2: '40' }
    expect(taxInfoSchema.safeParse(values).success).toBe(true)
    expect(taxInfoBody(values)).toMatchObject({
      name: 'Hộ kinh doanh Hiền',
      signer_name: null,
      business_area_m2: '40',
      declaration_period: 'quarter',
      locations: [
        { branch_id: 'posbranch_1', tax_location_code: '00001', tax_head_office: true },
        { branch_id: 'posbranch_2', tax_location_code: null, tax_head_office: false },
      ],
    })
  })

  it('refuses a blank name, a negative area and a location code with spaces', () => {
    const values = taxInfoValues(record)
    const result = taxInfoSchema.safeParse({
      ...values,
      name: ' ',
      business_area_m2: '-1',
      locations: [{ ...values.locations[0], tax_location_code: 'a b' }],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.message).sort()).toEqual([
      'taxInfo.errorArea',
      'taxInfo.errorLocationCode',
      'taxInfo.errorNameRequired',
    ])
  })
})
