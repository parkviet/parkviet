import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import {
  type DashboardLayout,
  defaultLayout,
  mergeLayout,
  toServerLayout,
  type WidgetSizes,
} from '../lib/dashboard-layout'
import { posRequest as request } from '../lib/pos-request'
import { posKey } from '../lib/query-keys'
import { useSession } from './use-session'

// The reader's home layout in the current store, kept on the server for
// this user (GET/PUT/DELETE /pos/dashboard_layout).
export type DashboardLayoutStore = {
  // The server's answer is still awaited; `layout` is not the reader's yet.
  pending: boolean
  // The server could not be read; nothing should be saved over it.
  error: unknown
  retry: () => void
  // The stored layout merged with the known widgets, or the default.
  layout: DashboardLayout
  // The layout every reader starts from.
  defaults: DashboardLayout
  // Whether the reader has a stored layout; without one they follow the
  // default, which may change with later releases.
  customized: boolean
  // Rejects when the server refuses; the caller keeps its draft.
  save: (layout: DashboardLayout) => Promise<void>
  // Forgets the stored layout so the default applies again.
  reset: () => Promise<void>
}

type StoredLayout = { layout: unknown; version: number; updated_at: string | null }

// Layouts kept on this device before they moved to the server, one per store.
const storageKey = (storeId: string) => `parkviet-pos-dashboard-home-layout:${storeId}`

export function readStoredLayout(storeId: string): unknown {
  try {
    const raw = localStorage.getItem(storageKey(storeId))
    return raw === null ? null : JSON.parse(raw)
  } catch {
    // Restricted storage or a damaged value: nothing to bring over.
    return null
  }
}

export function forgetStoredLayout(storeId: string) {
  try {
    localStorage.removeItem(storageKey(storeId))
  } catch {
    // Restricted storage: there is nothing kept to forget.
  }
}

function readServerLayout() {
  return request<{ data: StoredLayout | null } | null>('GET', '/pos/dashboard_layout').then(
    (response) => response?.data ?? null,
  )
}

// `defaultWidgets` are the widgets of the default layout, in order; the
// other known widgets are offered by the "add widget" sheet.
//
// A layout this device kept before the server stored them is uploaded once,
// the first time the server is read and has none, then forgotten here; if
// the upload fails it is still shown and tried again on the next visit.
export function useDashboardLayout(
  storeId: string,
  sizes: WidgetSizes,
  defaultWidgets?: readonly string[],
): DashboardLayoutStore {
  const { status } = useSession()
  const client = useQueryClient()
  const key = posKey(storeId, 'dashboard-layout')
  const query = useQuery({
    queryKey: key,
    enabled: status === 'authenticated',
    // Only this user writes it; saves update the cache directly.
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: readServerLayout,
  })
  const put = useMutation({
    mutationFn: (layout: DashboardLayout) =>
      request<{ data: StoredLayout }>('PUT', '/pos/dashboard_layout', {
        body: { layout: toServerLayout(layout, sizes) },
      }),
    onSuccess: (response) => {
      client.setQueryData(key, response.data)
      forgetStoredLayout(storeId)
    },
  })
  const remove = useMutation({
    mutationFn: () => request<unknown>('DELETE', '/pos/dashboard_layout'),
    onSuccess: () => {
      client.setQueryData(key, null)
      forgetStoredLayout(storeId)
    },
  })

  const server = query.data
  // A layout kept on this device, shown while the server has none.
  const local = useMemo(
    () => (server === null ? mergeLayout(readStoredLayout(storeId), sizes) : null),
    [server, storeId, sizes],
  )
  const uploaded = useRef<string | null>(null)
  const upload = put.mutate
  useEffect(() => {
    if (!local || uploaded.current === storeId) return
    uploaded.current = storeId
    upload(local, {
      onError: (error) => console.warn('Home layout of this device was not uploaded yet', error),
    })
  }, [local, storeId, upload])

  const defaults = useMemo(() => defaultLayout(sizes, defaultWidgets), [sizes, defaultWidgets])
  const layout = useMemo(
    () => (server ? mergeLayout(server.layout, sizes) : local) ?? defaults,
    [server, local, sizes, defaults],
  )
  const save = put.mutateAsync
  const resetAsync = remove.mutateAsync
  return {
    pending: query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
    layout,
    defaults,
    customized: Boolean(server) || Boolean(local),
    save: async (next) => {
      await save(next)
    },
    reset: async () => {
      await resetAsync()
    },
  }
}
