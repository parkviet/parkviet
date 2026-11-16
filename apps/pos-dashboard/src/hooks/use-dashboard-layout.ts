import { useCallback, useMemo, useState } from 'react'
import {
  type DashboardLayout,
  defaultLayout,
  mergeLayout,
  type WidgetSizes,
} from '../lib/dashboard-layout'

// The reader's home layout. Kept on this device for now, one per store; the
// page only uses `layout`, `save` and `reset`, so the storage can move to the
// server without touching it.
export type DashboardLayoutStore = {
  // The stored layout merged with the known widgets, or the default.
  layout: DashboardLayout
  // The layout every reader starts from.
  defaults: DashboardLayout
  save: (layout: DashboardLayout) => Promise<void>
  // Forgets the stored layout so the default applies again.
  reset: () => Promise<void>
}

const storageKey = (storeId: string) => `parkviet-pos-dashboard-home-layout:${storeId}`

export function readStoredLayout(storeId: string): unknown {
  try {
    const raw = localStorage.getItem(storageKey(storeId))
    return raw === null ? null : JSON.parse(raw)
  } catch {
    // Restricted storage or a damaged value: start from the default.
    return null
  }
}

// Throws when storage is unavailable or full, so the page can say so.
export function writeStoredLayout(storeId: string, layout: DashboardLayout | null) {
  if (layout === null) localStorage.removeItem(storageKey(storeId))
  else localStorage.setItem(storageKey(storeId), JSON.stringify(layout))
}

export function useDashboardLayout(storeId: string, sizes: WidgetSizes): DashboardLayoutStore {
  const [stored, setStored] = useState(() => ({ storeId, value: readStoredLayout(storeId) }))
  // Another store was opened: read its layout instead of showing this one's.
  const current =
    stored.storeId === storeId ? stored : { storeId, value: readStoredLayout(storeId) }
  if (current !== stored) setStored(current)
  const defaults = useMemo(() => defaultLayout(sizes), [sizes])
  const layout = useMemo(
    () => mergeLayout(current.value, sizes) ?? defaults,
    [current.value, sizes, defaults],
  )
  const save = useCallback(
    async (next: DashboardLayout) => {
      writeStoredLayout(storeId, next)
      setStored({ storeId, value: next })
    },
    [storeId],
  )
  const reset = useCallback(async () => {
    writeStoredLayout(storeId, null)
    setStored({ storeId, value: null })
  }, [storeId])
  return { layout, defaults, save, reset }
}
