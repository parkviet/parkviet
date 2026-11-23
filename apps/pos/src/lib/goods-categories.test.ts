import { describe, expect, it } from 'vitest'
import {
  type CategoryRow,
  categoryLabel,
  categoryTree,
  lastIndexUnder,
  membershipChanges,
  stepIndex,
  subtreeIds,
} from './goods-categories'

const row = (id: string, lft: number, parent_id: string | null = null): CategoryRow => ({
  id,
  name: id,
  pretty_name: parent_id ? `${parent_id} -> ${id}` : id,
  parent_id,
  depth: parent_id ? 1 : 0,
  lft,
  products_count: 0,
  children_count: 0,
})
// drinks (tea, coffee (espresso)), food
const rows = [
  row('food', 9),
  row('coffee', 4, 'drinks'),
  row('drinks', 1),
  row('tea', 2, 'drinks'),
  row('espresso', 5, 'coffee'),
]

describe('categoryTree', () => {
  it('orders by tree position and places each category among its siblings', () => {
    const tree = categoryTree(rows)
    expect(tree.map((item) => item.id)).toEqual(['drinks', 'tea', 'coffee', 'espresso', 'food'])
    const place = Object.fromEntries(
      tree.map((item) => [item.id, [item.siblingIndex, item.siblingCount]]),
    )
    expect(place).toEqual({
      drinks: [0, 2],
      food: [1, 2],
      tea: [0, 2],
      coffee: [1, 2],
      espresso: [0, 1],
    })
  })
})

describe('stepIndex', () => {
  const tree = categoryTree(rows)
  const of = (id: string) => {
    const found = tree.find((item) => item.id === id)
    if (!found) throw new Error(id)
    return found
  }
  it('moves within the siblings and stops at both ends', () => {
    expect(stepIndex(of('drinks'), -1)).toBeNull()
    expect(stepIndex(of('drinks'), 1)).toBe(1)
    expect(stepIndex(of('food'), 1)).toBeNull()
    expect(stepIndex(of('coffee'), -1)).toBe(0)
    expect(stepIndex(of('espresso'), -1)).toBeNull()
    expect(stepIndex(of('espresso'), 1)).toBeNull()
  })
})

describe('subtreeIds', () => {
  it('collects the category and every descendant', () => {
    expect([...subtreeIds(rows, 'drinks')].sort()).toEqual(['coffee', 'drinks', 'espresso', 'tea'])
    expect([...subtreeIds(rows, 'food')]).toEqual(['food'])
    expect([...subtreeIds(rows, '')]).toEqual([''])
  })
})

describe('lastIndexUnder', () => {
  it('counts the other children of the target parent', () => {
    expect(lastIndexUnder(rows, null)).toBe(2)
    expect(lastIndexUnder(rows, null, 'food')).toBe(1)
    expect(lastIndexUnder(rows, 'drinks', 'food')).toBe(2)
    expect(lastIndexUnder(rows, 'tea')).toBe(0)
  })
})

describe('membershipChanges', () => {
  it('adds what was picked and removes what was dropped', () => {
    expect(membershipChanges(['a', 'b', 'c'], ['c', 'd', 'a', 'e'])).toEqual({
      add: ['d', 'e'],
      remove: ['b'],
    })
    expect(membershipChanges([], [])).toEqual({ add: [], remove: [] })
    expect(membershipChanges(['a'], [])).toEqual({ add: [], remove: ['a'] })
  })
})

describe('categoryLabel', () => {
  it('reads the full path, falling back to the name', () => {
    expect(categoryLabel({ name: 'Trà', pretty_name: 'Đồ uống -> Trà' })).toBe('Đồ uống -> Trà')
    expect(categoryLabel({ name: 'Trà', pretty_name: '' })).toBe('Trà')
  })
})
