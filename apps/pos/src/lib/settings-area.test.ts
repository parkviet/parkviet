import { describe, expect, it } from 'vitest'
import { isSettingsRailPath } from './settings-area'

describe('isSettingsRailPath', () => {
  it('covers the pages listed in the settings rail', () => {
    expect(isSettingsRailPath('/store_1/settings')).toBe(true)
    expect(isSettingsRailPath('/store_1/settings/setup')).toBe(true)
    expect(isSettingsRailPath('/store_1/settings/einvoice')).toBe(true)
    expect(isSettingsRailPath('/store_1/settings/system')).toBe(true)
  })

  it('leaves Thiết lập pages to the shell so they are not double-padded', () => {
    expect(isSettingsRailPath('/store_1/settings/store-info')).toBe(false)
    expect(isSettingsRailPath('/store_1/settings/tax-info')).toBe(false)
    expect(isSettingsRailPath('/store_1/settings/tax')).toBe(false)
    expect(isSettingsRailPath('/store_1/settings/stores')).toBe(false)
    expect(isSettingsRailPath('/store_1/settings/receipt-templates')).toBe(false)
    expect(isSettingsRailPath('/store_1/settings/receipt-templates/tpl_1')).toBe(false)
  })

  it('ignores ordinary pages', () => {
    expect(isSettingsRailPath('/store_1')).toBe(false)
    expect(isSettingsRailPath('/store_1/branches')).toBe(false)
    expect(isSettingsRailPath('/store_1/setup')).toBe(false)
  })
})
