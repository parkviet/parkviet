import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  categories: {
    create: vi.fn(),
    update: vi.fn(),
    reposition: vi.fn(),
    products: { create: vi.fn(), delete: vi.fn(), list: vi.fn() },
  },
}))
vi.mock('@spree/dashboard-core', () => ({
  adminClient: sdk,
  usePermissions: vi.fn(),
  useResourceMutation: vi.fn(),
}))

const { saveCategory } = await import('./use-goods-categories')
type Saved = Parameters<typeof saveCategory>[0]
const fresh: Saved = { name: '', parentId: null, productIds: [] }

beforeEach(() => {
  vi.clearAllMocks()
  sdk.categories.create.mockResolvedValue({ id: 'ctg_new' })
  sdk.categories.update.mockResolvedValue({})
  sdk.categories.reposition.mockResolvedValue({})
  sdk.categories.products.create.mockResolvedValue({ added_count: 1 })
  sdk.categories.products.delete.mockResolvedValue({ removed_count: 1 })
})

describe('saveCategory', () => {
  it('creates an empty category with nothing else to send', async () => {
    const progress = vi.fn()
    const id = await saveCategory(
      fresh,
      { name: 'Đồ uống', parentId: null, productIds: [], lastIndex: 0 },
      progress,
    )
    expect(id).toBe('ctg_new')
    expect(sdk.categories.create).toHaveBeenCalledWith({ name: 'Đồ uống' })
    expect(sdk.categories.update).not.toHaveBeenCalled()
    expect(sdk.categories.reposition).not.toHaveBeenCalled()
    expect(sdk.categories.products.create).not.toHaveBeenCalled()
    expect(progress).toHaveBeenLastCalledWith({
      id: 'ctg_new',
      name: 'Đồ uống',
      parentId: null,
      productIds: [],
    })
  })

  it('creates under a parent and adds the picked products', async () => {
    await saveCategory(
      fresh,
      { name: 'Trà', parentId: 'ctg_drinks', productIds: ['p1', 'p2'], lastIndex: 3 },
      vi.fn(),
    )
    expect(sdk.categories.create).toHaveBeenCalledWith({ name: 'Trà', parent_id: 'ctg_drinks' })
    expect(sdk.categories.reposition).not.toHaveBeenCalled()
    expect(sdk.categories.products.create).toHaveBeenCalledWith('ctg_new', ['p1', 'p2'])
  })

  it('renames, moves to the top level and changes the members of an existing category', async () => {
    const progress = vi.fn()
    await saveCategory(
      { id: 'ctg_tea', name: 'Tra', parentId: 'ctg_drinks', productIds: ['p1', 'p2'] },
      { name: 'Trà', parentId: null, productIds: ['p2', 'p3'], lastIndex: 4 },
      progress,
    )
    expect(sdk.categories.create).not.toHaveBeenCalled()
    expect(sdk.categories.update).toHaveBeenCalledWith('ctg_tea', { name: 'Trà' })
    expect(sdk.categories.reposition).toHaveBeenCalledWith('ctg_tea', {
      new_parent_id: null,
      new_position: 4,
    })
    expect(sdk.categories.products.delete).toHaveBeenCalledWith('ctg_tea', ['p1'])
    expect(sdk.categories.products.create).toHaveBeenCalledWith('ctg_tea', ['p3'])
    expect(progress).toHaveBeenLastCalledWith({
      id: 'ctg_tea',
      name: 'Trà',
      parentId: null,
      productIds: ['p2', 'p3'],
    })
  })

  it('reports the created category before a later step fails, so a retry does not create again', async () => {
    sdk.categories.products.create.mockRejectedValueOnce(new Error('offline'))
    let saved = fresh
    const keep = (next: Saved) => {
      saved = next
    }
    const draft = { name: 'Bánh', parentId: null, productIds: ['p1'], lastIndex: 0 }
    await expect(saveCategory(saved, draft, keep)).rejects.toThrow('offline')
    expect(saved).toEqual({ id: 'ctg_new', name: 'Bánh', parentId: null, productIds: [] })

    await saveCategory(saved, draft, keep)
    expect(sdk.categories.create).toHaveBeenCalledTimes(1)
    expect(sdk.categories.update).not.toHaveBeenCalled()
    expect(sdk.categories.products.create).toHaveBeenLastCalledWith('ctg_new', ['p1'])
    expect(saved.productIds).toEqual(['p1'])
  })
})
