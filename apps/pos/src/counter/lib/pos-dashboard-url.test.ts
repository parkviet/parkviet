import { describe, expect, it } from 'vitest'
import { posDashboardHomeUrl, posDashboardUrl, withSearch } from './pos-dashboard-url'

describe('POS dashboard links', () => {
  it('resolves same-origin paths from the current app basePath', () => {
    expect(posDashboardUrl('store_1', '', null, { basePath: '/' })).toBe('/store_1')
    expect(posDashboardUrl('store_1', 'settings/system', 'branch_1', { basePath: '/pos/' })).toBe(
      '/pos/store_1/settings/system?branch=branch_1',
    )
    expect(posDashboardHomeUrl({ basePath: '/' })).toBe('/')
    expect(posDashboardHomeUrl({ basePath: '/pos/' })).toBe('/pos/')
  })

  it('preserves an explicit baseUrl and encodes store and branch identities', () => {
    expect(
      posDashboardUrl('store /1', '/features', 'branch /2', {
        baseUrl: 'https://admin.example.test/pos/?old=1#old',
      }),
    ).toBe('https://admin.example.test/pos/store%20%2F1/features?branch=branch+%2F2')
  })

  it('resolves a path-only base against the current origin when present', () => {
    const location = { baseUrl: '/pos/', origin: 'http://192.168.1.10' }
    expect(posDashboardUrl('store_1', '/settings/system', null, location)).toBe(
      'http://192.168.1.10/pos/store_1/settings/system',
    )
    expect(posDashboardHomeUrl(location)).toBe('http://192.168.1.10/pos/')
    expect(
      posDashboardUrl('store_1', '', null, {
        baseUrl: '//other.test/',
        origin: 'http://192.168.1.10',
      }),
    ).toBeNull()
  })

  it('links to receipt settings without carrying a sale or session token', () => {
    expect(
      posDashboardUrl('store_1', '/settings/receipt-templates', null, {
        baseUrl: 'https://admin.example.test',
      }),
    ).toBe('https://admin.example.test/store_1/settings/receipt-templates')
  })

  it('fails closed on missing identity and unsafe configuration or paths', () => {
    expect(posDashboardUrl(null, '', null, { basePath: '/' })).toBeNull()
    expect(posDashboardUrl('..', '', null, { basePath: '/' })).toBeNull()
    for (const baseUrl of ['invalid', 'javascript:alert(1)', 'https://user:pass@example.test']) {
      expect(posDashboardUrl('store_1', '', null, { baseUrl })).toBeNull()
    }
    for (const path of ['../login', '//other.test/login', 'https://other.test', 'features?x=1']) {
      expect(posDashboardUrl('store_1', path, null, { basePath: '/' })).toBeNull()
    }
  })

  it('adds page parameters to a dashboard link and keeps a missing link missing', () => {
    const url = posDashboardUrl('store_1', 'funds', 'branch_1', { basePath: '/' })
    expect(withSearch(url, { fundsId: 'posfunds_1' })).toBe(
      '/store_1/funds?branch=branch_1&fundsId=posfunds_1',
    )
    expect(withSearch(null, { fundsId: 'posfunds_1' })).toBeNull()
  })
})
