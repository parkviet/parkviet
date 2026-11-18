import type { Category } from '@spree/admin-sdk'

// Pure shaping of the store's Spree categories for the goods categories
// screen. A category tree is a nested set per store, so `lft` is the tree
// order and siblings share a `parent_id`; a reposition index is 0-based
// among the siblings of the target parent.

export type CategoryRow = Pick<
  Category,
  | 'id'
  | 'name'
  | 'pretty_name'
  | 'parent_id'
  | 'depth'
  | 'lft'
  | 'products_count'
  | 'children_count'
> &
  Partial<Pick<Category, 'image_url'>>

export type TreeCategory<T extends CategoryRow = CategoryRow> = T & {
  // 0-based place among the category's siblings, and how many siblings it has.
  siblingIndex: number
  siblingCount: number
}

const parentOf = (row: CategoryRow) => row.parent_id ?? null

// The categories in tree order, each with its place among its siblings.
export function categoryTree<T extends CategoryRow>(rows: readonly T[]): TreeCategory<T>[] {
  const sorted = [...rows].sort((a, b) => a.lft - b.lft)
  const groups = new Map<string | null, T[]>()
  for (const row of sorted) {
    const key = parentOf(row)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return sorted.map((row) => {
    const siblings = groups.get(parentOf(row)) ?? [row]
    return { ...row, siblingIndex: siblings.indexOf(row), siblingCount: siblings.length }
  })
}

// The category itself and everything under it, which cannot become its parent.
export function subtreeIds(rows: readonly CategoryRow[], id: string): Set<string> {
  const ids = new Set([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const row of rows) {
      const parent = parentOf(row)
      if (parent && ids.has(parent) && !ids.has(row.id)) {
        ids.add(row.id)
        grew = true
      }
    }
  }
  return ids
}

// Where a category lands among the siblings when moved one step up or down,
// or null when it is already at that end.
export function stepIndex(row: TreeCategory, step: -1 | 1): number | null {
  const next = row.siblingIndex + step
  return next < 0 || next >= row.siblingCount ? null : next
}

// The index that puts a category last under a new parent: the count of the
// parent's other children (the server clamps to that count).
export const lastIndexUnder = (
  rows: readonly CategoryRow[],
  parentId: string | null,
  id?: string,
) => rows.filter((row) => parentOf(row) === parentId && row.id !== id).length

// Products to add to and remove from a category so that its members become
// `selected`, keeping the order the ids were picked in.
export function membershipChanges(original: readonly string[], selected: readonly string[]) {
  const before = new Set(original)
  const after = new Set(selected)
  return {
    add: [...after].filter((id) => !before.has(id)),
    remove: [...before].filter((id) => !after.has(id)),
  }
}

// What a category row reads by: the full path, falling back to its name.
export const categoryLabel = (row: Pick<CategoryRow, 'name' | 'pretty_name'>) =>
  row.pretty_name || row.name
