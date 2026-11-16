import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStoredLayout, writeStoredLayout } from './use-dashboard-layout'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  }
}

describe('home layout storage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps one layout per store and forgets it on reset', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    const layout = [{ id: 'funds', widget: 'funds', x: 0, y: 0, w: 4, h: 3 }]
    writeStoredLayout('store_1', layout)
    expect(readStoredLayout('store_1')).toEqual(layout)
    expect(readStoredLayout('store_2')).toBeNull()
    writeStoredLayout('store_1', null)
    expect(readStoredLayout('store_1')).toBeNull()
  })

  it('reads a damaged or unavailable value as no layout', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{not json' })
    expect(readStoredLayout('store_1')).toBeNull()
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
    })
    expect(readStoredLayout('store_1')).toBeNull()
  })

  it('reports a write the device refuses', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(() => writeStoredLayout('store_1', [])).toThrow('quota')
  })
})
