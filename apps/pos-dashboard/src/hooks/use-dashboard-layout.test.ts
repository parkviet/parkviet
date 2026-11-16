import { afterEach, describe, expect, it, vi } from 'vitest'
import { forgetStoredLayout, readStoredLayout } from './use-dashboard-layout'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  }
}

describe('home layout kept on this device before the server', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads the layout of one store and forgets it once uploaded', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    const layout = [{ id: 'funds', widget: 'funds', x: 0, y: 0, w: 4, h: 3 }]
    storage.setItem('parkviet-pos-dashboard-home-layout:store_1', JSON.stringify(layout))
    expect(readStoredLayout('store_1')).toEqual(layout)
    expect(readStoredLayout('store_2')).toBeNull()
    forgetStoredLayout('store_1')
    expect(readStoredLayout('store_1')).toBeNull()
  })

  it('reads a damaged or unavailable value as no layout', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{not json' })
    expect(readStoredLayout('store_1')).toBeNull()
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })
    expect(readStoredLayout('store_1')).toBeNull()
    expect(() => forgetStoredLayout('store_1')).not.toThrow()
  })
})
