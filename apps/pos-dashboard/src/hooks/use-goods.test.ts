import { describe, expect, it, vi } from 'vitest'
import { branchStockLocations, goodsKey } from './use-goods'

vi.mock('@spree/dashboard-core', () => ({
  adminClient: {},
  useResourceMutation: vi.fn(),
  usePermissions: vi.fn(),
  useStore: vi.fn(),
  useAuth: vi.fn(),
}))

describe('goods catalog wrappers', () => {
  it('keys every query under the store goods prefix', () => {
    expect(goodsKey('store_1', 'products', { page: 1 })).toEqual([
      'pos',
      'store_1',
      'goods',
      'products',
      { page: 1 },
    ])
  })
  it('maps each branch to the stock location it sells from', () => {
    expect(
      branchStockLocations([
        {
          id: 'br_1',
          name: 'Quận 1',
          stock_location_id: 'sloc_1',
          receiving_stock_location_id: null,
        },
        {
          id: 'br_2',
          name: 'Kho tổng',
          stock_location_id: 'sloc_2',
          receiving_stock_location_id: 'sloc_3',
        },
      ]),
    ).toEqual([
      {
        branchId: 'br_1',
        branchName: 'Quận 1',
        stockLocationId: 'sloc_1',
        receivingStockLocationId: null,
      },
      {
        branchId: 'br_2',
        branchName: 'Kho tổng',
        stockLocationId: 'sloc_2',
        receivingStockLocationId: 'sloc_3',
      },
    ])
  })
})
