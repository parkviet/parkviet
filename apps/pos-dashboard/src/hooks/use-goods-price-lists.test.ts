import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  priceLists: { create: vi.fn(), update: vi.fn(), activate: vi.fn() },
  catalogs: { create: vi.fn(), get: vi.fn(), update: vi.fn(), activate: vi.fn() },
}))
vi.mock('@spree/dashboard-core', () => ({ adminClient: sdk }))
vi.mock('./use-session', () => ({ useSession: vi.fn() }))

const { savePriceList } = await import('./use-goods-price-lists')
type Saved = Parameters<typeof savePriceList>[0]['saved']

const payload = { name: 'Giá sỉ', description: 'BG000001' }

beforeEach(() => {
  vi.clearAllMocks()
  sdk.priceLists.create.mockResolvedValue({ id: 'pl_1' })
  sdk.catalogs.create.mockResolvedValue({ id: 'cat_1' })
  sdk.catalogs.get.mockResolvedValue({ id: 'cat_1', price_list: { id: 'pl_cat' } })
})

async function saveWith(saved: Saved, groupIds: string[] | null) {
  const steps: NonNullable<Saved>[] = []
  try {
    const result = await savePriceList({
      saved,
      payload,
      groupIds,
      progress: (next) => steps.push(next),
    })
    return { result, steps, error: null as unknown }
  } catch (error) {
    return { result: null, steps, error }
  }
}

describe('savePriceList', () => {
  it('creates and switches on a list for all customers', async () => {
    const { result, steps } = await saveWith(null, null)
    expect(result).toEqual({ listId: 'pl_1', catalogId: null, activated: true })
    expect(steps.at(-1)).toEqual(result)
    expect(sdk.priceLists.activate).toHaveBeenCalledWith('pl_1')
    expect(sdk.priceLists.update).not.toHaveBeenCalled()
  })

  it('retries a failed activation without creating the list again', async () => {
    sdk.priceLists.activate.mockRejectedValueOnce(new Error('offline'))
    const first = await saveWith(null, null)
    expect(first.error).toBeInstanceOf(Error)
    const recorded = first.steps.at(-1) ?? null
    expect(recorded).toEqual({ listId: 'pl_1', catalogId: null, activated: false })

    const second = await saveWith(recorded, null)
    expect(second.result).toEqual({ listId: 'pl_1', catalogId: null, activated: true })
    expect(sdk.priceLists.create).toHaveBeenCalledTimes(1)
    expect(sdk.priceLists.update).toHaveBeenCalledWith('pl_1', payload)
    expect(sdk.priceLists.activate).toHaveBeenCalledTimes(2)
  })

  it('keeps the created catalog when reading it back fails, and finishes it on retry', async () => {
    sdk.catalogs.get.mockRejectedValueOnce(new Error('offline'))
    const first = await saveWith(null, ['grp_vip'])
    expect(first.error).toBeInstanceOf(Error)
    const recorded = first.steps.at(-1) ?? null
    expect(recorded).toEqual({ listId: null, catalogId: 'cat_1', activated: false })

    const second = await saveWith(recorded, ['grp_vip'])
    expect(second.result).toEqual({ listId: 'pl_cat', catalogId: 'cat_1', activated: true })
    expect(sdk.catalogs.create).toHaveBeenCalledTimes(1)
    expect(sdk.catalogs.update).toHaveBeenCalledWith('cat_1', {
      name: 'Giá sỉ',
      assignments: [{ assignable_type: 'customer_group', assignable_id: 'grp_vip' }],
    })
    expect(sdk.catalogs.activate).toHaveBeenCalledWith('cat_1')
    expect(sdk.priceLists.activate).not.toHaveBeenCalled()
  })

  it('leaves the status of a stored list alone', async () => {
    const { result } = await saveWith({ listId: 'pl_9', catalogId: null, activated: true }, null)
    expect(result).toEqual({ listId: 'pl_9', catalogId: null, activated: true })
    expect(sdk.priceLists.update).toHaveBeenCalledWith('pl_9', payload)
    expect(sdk.priceLists.activate).not.toHaveBeenCalled()
    expect(sdk.catalogs.activate).not.toHaveBeenCalled()
  })
})
