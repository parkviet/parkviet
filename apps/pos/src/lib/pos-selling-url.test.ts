import { describe, expect, it } from 'vitest'
import { posSellingConfigured, posSellingUrl } from './pos-selling-url'

describe('posSellingUrl', () => {
  it('always reports configured in the unified POS app', () => {
    expect(posSellingConfigured()).toBe(true)
  })

  it('builds a store-scoped counter path at root basePath', () => {
    expect(posSellingUrl('store_1', null, { basePath: '/' })).toBe('/store_1/sell')
    expect(posSellingUrl('store_1', 'posbr_1', { basePath: '/' })).toBe(
      '/store_1/sell?branch=posbr_1',
    )
  })

  it('prepends the deployment base path when mounted under /pos/', () => {
    expect(posSellingUrl('store_1', 'posbr_2', { basePath: '/pos/' })).toBe(
      '/pos/store_1/sell?branch=posbr_2',
    )
  })

  it('rejects missing or invalid store ids and ignores invalid branch ids', () => {
    expect(posSellingUrl(null, 'posbr_1', { basePath: '/' })).toBeNull()
    expect(posSellingUrl('../other', 'posbr_1', { basePath: '/' })).toBeNull()
    expect(posSellingUrl('store_1', '../bad', { basePath: '/' })).toBe('/store_1/sell')
  })
})
