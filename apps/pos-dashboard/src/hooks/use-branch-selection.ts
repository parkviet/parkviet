import type { PosBranch, PosSelection } from '@parkviet/pos-shared/types/pos-context'
import { useNavigate, useParams, useSearch } from '@tanstack/react-router'

// The URL's branch when visible, else the store's default branch when visible,
// else the first visible one.
export function resolveBranchSelection(
  search: { branch?: string; register?: string },
  branches: readonly PosBranch[] = [],
): PosSelection {
  const visible = (id: string | null | undefined): id is string =>
    !!id && branches.some((branch) => branch.id === id)
  const branchId = visible(search.branch)
    ? search.branch
    : (branches.find((branch) => branch.is_default)?.id ?? branches[0]?.id ?? null)
  return { branchId, registerId: branchId === search.branch ? (search.register ?? null) : null }
}
export function useBranchSelection(branches: readonly PosBranch[] = []) {
  const search = useSearch({ strict: false }) as { branch?: string; register?: string }
  const params = useParams({ strict: false }) as { branchId?: string }
  const navigate = useNavigate()
  const selection = resolveBranchSelection(
    { ...search, branch: params.branchId ?? search.branch },
    branches,
  )
  function setSelection(next: PosSelection) {
    void navigate({
      to: '.',
      params: params.branchId && next.branchId ? { branchId: next.branchId } : {},
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        branch: next.branchId ?? undefined,
        register: next.registerId ?? undefined,
      }),
      replace: true,
    })
  }
  return {
    ...selection,
    selection,
    setSelection,
    setBranchId: (branchId: string | null) => setSelection({ branchId, registerId: null }),
  }
}
