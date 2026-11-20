import { describe, expect, it, vi } from 'vitest'
import {
  ensurePosChannel,
  ensureProductTypes,
  GoodsSetupError,
  productKindOf,
  productTypesByKind,
} from './use-goods-setup'

vi.mock('@spree/dashboard-core', () => ({ adminClient: {}, usePermissions: vi.fn() }))

const page = <T>(data: T[], next: number | null = null) => ({ data, meta: { next } })
const channel = (overrides: Record<string, unknown> = {}) => ({
  id: 'ch_pos',
  code: 'pos',
  name: 'Point of Sale',
  active: true,
  ...overrides,
})
function fakeClient({
  channels = [] as unknown[][],
  types = [] as unknown[][],
  createChannel = vi.fn(async () => channel({ id: 'ch_new' })),
  createType = vi.fn(async ({ name }: { name: string }) => ({ id: `pt_${name}`, name })),
} = {}) {
  let channelReads = 0
  let typeReads = 0
  const client = {
    channels: {
      list: vi.fn(async () => page(channels[Math.min(channelReads++, channels.length - 1)] ?? [])),
      create: createChannel,
    },
    productTypes: {
      // One page per read; each later read sees the next snapshot.
      list: vi.fn(async () => page(types[Math.min(typeReads++, types.length - 1)] ?? [])),
      create: createType,
    },
  }
  return client as unknown as Parameters<typeof ensurePosChannel>[1] & typeof client
}

describe('product kinds', () => {
  it('recognizes the three POS types by name, whatever the marks, case or spacing', () => {
    expect(productKindOf('Hàng hoá')).toBe('goods')
    expect(productKindOf('Hàng hóa')).toBe('goods')
    expect(productKindOf('  hang   HOA ')).toBe('goods')
    expect(productKindOf('Sản phẩm thường')).toBe('goods')
    expect(productKindOf('Sản phẩm chế biến')).toBe('prepared')
    expect(productKindOf('Dịch vụ')).toBe('service')
    expect(productKindOf('Nguyên liệu')).toBe('ingredient')
    expect(productKindOf('Apparel')).toBeNull()
  })
  it('keeps the first type of each kind', () => {
    const found = productTypesByKind([
      { id: 'a', name: 'Hàng hóa' },
      { id: 'b', name: 'Hàng hoá' },
      { id: 'c', name: 'Shoes' },
    ])
    expect(found).toEqual({ goods: { id: 'a', name: 'Hàng hóa' } })
  })
})

describe('ensurePosChannel', () => {
  it('returns the existing pos channel without writing', async () => {
    const client = fakeClient({ channels: [[channel({ active: false })]] })
    await expect(ensurePosChannel({ canCreate: true }, client)).resolves.toEqual({
      id: 'ch_pos',
      active: false,
      created: false,
    })
    expect(client.channels.list).toHaveBeenCalledWith({ code_eq: 'pos', limit: 100 })
    expect(client.channels.create).not.toHaveBeenCalled()
  })
  it('ignores a channel whose code only resembles pos', async () => {
    const client = fakeClient({ channels: [[channel({ id: 'ch_x', code: 'pos-old' })]] })
    const result = await ensurePosChannel({ canCreate: true }, client)
    expect(result).toEqual({ id: 'ch_new', active: true, created: true })
  })
  it('creates it active and not default when missing', async () => {
    const client = fakeClient({ channels: [[]] })
    await ensurePosChannel({ canCreate: true }, client)
    expect(client.channels.create).toHaveBeenCalledWith({
      name: 'Point of Sale',
      code: 'pos',
      active: true,
      default: false,
    })
  })
  it('refuses to create without the settings key', async () => {
    const client = fakeClient({ channels: [[]] })
    await expect(ensurePosChannel({ canCreate: false }, client)).rejects.toEqual(
      new GoodsSetupError('pos_channel_forbidden'),
    )
    expect(client.channels.create).not.toHaveBeenCalled()
  })
  it('answers a lost creation race with the channel that won', async () => {
    const createChannel = vi.fn(async () => {
      throw new Error('code taken')
    })
    const client = fakeClient({ channels: [[], [channel({ id: 'ch_other' })]], createChannel })
    await expect(ensurePosChannel({ canCreate: true }, client)).resolves.toEqual({
      id: 'ch_other',
      active: true,
      created: false,
    })
  })
  it('passes other creation failures on', async () => {
    const failure = new Error('422')
    const createChannel = vi.fn(async () => {
      throw failure
    })
    const client = fakeClient({ channels: [[]], createChannel })
    await expect(ensurePosChannel({ canCreate: true }, client)).rejects.toBe(failure)
  })
})

describe('ensureProductTypes', () => {
  it('reads every page and writes nothing when all three exist', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce(page([{ id: 'pt_g', name: 'Hàng hoá' }], 2))
      .mockResolvedValueOnce(
        page([
          { id: 'pt_p', name: 'Sản phẩm chế biến' },
          { id: 'pt_s', name: 'Dịch vụ' },
          { id: 'pt_i', name: 'Nguyên liệu' },
        ]),
      )
    const create = vi.fn()
    const client = { channels: {}, productTypes: { list, create } } as never
    await expect(ensureProductTypes({ canCreate: false }, client)).resolves.toEqual({
      goods: 'pt_g',
      prepared: 'pt_p',
      service: 'pt_s',
      ingredient: 'pt_i',
    })
    expect(list).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenLastCalledWith({ page: 2, limit: 100 })
    expect(create).not.toHaveBeenCalled()
  })
  it('creates only the missing kinds by their fixed names', async () => {
    const client = fakeClient({ types: [[{ id: 'pt_g', name: 'Hang hoa' }]] })
    await expect(ensureProductTypes({ canCreate: true }, client)).resolves.toEqual({
      goods: 'pt_g',
      prepared: 'pt_Sản phẩm chế biến',
      service: 'pt_Dịch vụ',
      ingredient: 'pt_Nguyên liệu',
    })
    expect(client.productTypes.create).toHaveBeenCalledTimes(3)
    expect(client.productTypes.create).toHaveBeenCalledWith({ name: 'Sản phẩm chế biến' })
    expect(client.productTypes.create).toHaveBeenCalledWith({ name: 'Dịch vụ' })
    expect(client.productTypes.create).toHaveBeenCalledWith({ name: 'Nguyên liệu' })
  })
  it('refuses without reading when the role cannot read product types', async () => {
    const client = fakeClient({ types: [[]] })
    await expect(ensureProductTypes({ canRead: false, canCreate: true }, client)).rejects.toEqual(
      new GoodsSetupError('product_types_unreadable'),
    )
    expect(client.productTypes.list).not.toHaveBeenCalled()
  })
  it('refuses before writing anything without the product types write key', async () => {
    const client = fakeClient({ types: [[{ id: 'pt_g', name: 'Hàng hoá' }]] })
    await expect(ensureProductTypes({ canCreate: false }, client)).rejects.toEqual(
      new GoodsSetupError('product_types_forbidden'),
    )
    expect(client.productTypes.create).not.toHaveBeenCalled()
  })
  it('answers a lost creation race with the type that won', async () => {
    const createType = vi.fn(async () => {
      throw new Error('name taken')
    })
    const client = fakeClient({
      types: [
        [
          { id: 'pt_g', name: 'Hàng hoá' },
          { id: 'pt_p', name: 'Sản phẩm chế biến' },
          { id: 'pt_i', name: 'Nguyên liệu' },
        ],
        [
          { id: 'pt_g', name: 'Hàng hoá' },
          { id: 'pt_p', name: 'Sản phẩm chế biến' },
          { id: 'pt_s2', name: 'Dịch vụ' },
          { id: 'pt_i', name: 'Nguyên liệu' },
        ],
      ],
      createType,
    })
    await expect(ensureProductTypes({ canCreate: true }, client)).resolves.toEqual({
      goods: 'pt_g',
      prepared: 'pt_p',
      service: 'pt_s2',
      ingredient: 'pt_i',
    })
  })
})
