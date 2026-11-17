import { describe, expect, it } from 'vitest'
import { normalizeSalesSettings, SALES_SETTING_DEFAULTS } from './sales-settings'

describe('normalizeSalesSettings', () => {
  it('fills every key when nothing was stored', () => {
    expect(normalizeSalesSettings(undefined)).toEqual(SALES_SETTING_DEFAULTS)
    expect(normalizeSalesSettings(null)).toEqual(SALES_SETTING_DEFAULTS)
    expect(normalizeSalesSettings([])).toEqual(SALES_SETTING_DEFAULTS)
  })

  it('keeps known values and drops a bad or unknown one', () => {
    expect(
      normalizeSalesSettings({
        allow_oversell: false,
        cart_order: 'newest_first',
        payment_chime: 'off',
        show_stock: 'yes',
        extra: true,
      }),
    ).toEqual({
      ...SALES_SETTING_DEFAULTS,
      allow_oversell: false,
      cart_order: 'newest_first',
      payment_chime: 'off',
    })
  })
})
