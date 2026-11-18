import { describe, expect, it } from 'vitest'
import { formatAreaTable } from '../components/emenu-sticker-print'
import { promotionPhase, readEmenuMenu, readEmenuSettings } from './use-emenu'

describe('e-Menu helpers', () => {
  it('preserves category color, id, and image_url when reading the e-Menu tree', () => {
    const parsed = readEmenuMenu([
      {
        id: 'posemenucat_1',
        name: ' Đồ uống ',
        color: '#0b6e4f',
        image_url: '/rails/active_storage/blobs/cat.png',
        items: [{ menu_item_id: 'menuitem_tea' }, 'menuitem_coffee'],
      },
      { name: '   ', items: [] },
    ])
    expect(parsed).toEqual([
      {
        id: 'posemenucat_1',
        name: 'Đồ uống',
        color: '#0b6e4f',
        image_url: '/rails/active_storage/blobs/cat.png',
        items: ['menuitem_tea', 'menuitem_coffee'],
      },
    ])
  })

  it('normalizes missing e-Menu settings to defaults', () => {
    const settings = readEmenuSettings({})
    expect(settings.brand_color).toBe('#0b6e4f')
    expect(settings.best_sellers_source).toBe('manual')
    expect(settings.best_sellers_limit).toBe(8)
    expect(settings.pay_methods).toEqual(['vietqr', 'counter'])
    expect(settings.sticker_size).toBe('80')
  })

  it('classifies promotions into running, upcoming, and ended', () => {
    // Wednesday 2026-11-18 14:30 in Asia/Ho_Chi_Minh (07:30 UTC), day = 3
    const now = new Date('2026-11-18T07:30:00Z')
    expect(promotionPhase({ status: 'archived', active_windows: [] }, now)).toBe('ended')
    expect(promotionPhase({ status: 'active', active_windows: [] }, now)).toBe('running')
    expect(
      promotionPhase(
        { status: 'active', active_windows: [{ days: [3], from: '13:00', to: '17:00' }] },
        now,
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe('running')
    expect(
      promotionPhase(
        { status: 'active', active_windows: [{ days: [3], from: '18:00', to: '22:00' }] },
        now,
        'Asia/Ho_Chi_Minh',
      ),
    ).toBe('upcoming')
    expect(
      promotionPhase(
        {
          status: 'active',
          active_windows: [],
          ends_at: '2026-11-18T06:00:00Z',
        },
        now,
      ),
    ).toBe('ended')
  })

  it('formats area–table labels cleanly', () => {
    expect(formatAreaTable('Tầng 1', 'Bàn 02')).toBe('Tầng 1 – Bàn 02')
    expect(formatAreaTable(undefined, 'Bàn 02')).toBe('Bàn 02')
  })
})
