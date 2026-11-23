import { adminClient, queryClient } from '@spree/dashboard-core'
import { getAuthToken } from '../../api-client'
import { connectivity } from './connectivity'
import { emitOfflineChanged, offlineDb } from './offline-store'
import { conflictReason, failureStatus } from './request-failure'
import { type SessionSnapshot, SessionSuperseded, type StoreChoice } from './session-coordinator'
import { clearIntents } from './uncertain-intents'
import { clearLayout } from './workspace-storage'

const STORE_KEY = 'parkviet-pos-store'
const SOCKET_TOKEN_EXPIRY_MARGIN_MS = 30_000

export function rememberStore(storeId: string) {
  try {
    window.localStorage.setItem(STORE_KEY, storeId)
  } catch {
    // Private mode: the cashier picks again next time.
  }
}

function tokenExpiryMs(token: string) {
  try {
    const payload = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown }
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

let snapshot: SessionSnapshot = {
  status: 'anonymous',
  generation: 0,
  email: '',
  name: '',
  stores: [],
  storeId: null,
}

let authLogout: (() => Promise<void>) | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function syncCounterSession(next: {
  authenticated: boolean
  email?: string | null
  name?: string | null
  stores?: StoreChoice[]
  storeId: string | null
  logout?: () => Promise<void>
}) {
  authLogout = next.logout ?? null
  const status = next.authenticated ? 'authenticated' : 'anonymous'
  const email = next.email ?? ''
  const name = next.name ?? ''
  const stores = next.stores ?? []
  const storeId = next.storeId
  const changed =
    snapshot.status !== status ||
    snapshot.email !== email ||
    snapshot.name !== name ||
    snapshot.storeId !== storeId ||
    snapshot.stores.length !== stores.length
  if (!changed) return
  const generation =
    snapshot.status !== status || snapshot.storeId !== storeId || snapshot.email !== email
      ? snapshot.generation + 1
      : snapshot.generation
  snapshot = { status, generation, email, name, stores, storeId }
  emit()
}

type RequestOptions = {
  params?: Record<string, string | number | boolean | string[] | undefined>
  body?: unknown
  headers?: Record<string, string>
  idempotencyKey?: string
  signal?: AbortSignal
}

export const session = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  request: async <T>(method: string, path: string, options?: RequestOptions): Promise<T> => {
    try {
      return await adminClient.request<T>(method, path, options)
    } catch (error) {
      if (conflictReason(error) === 'feature_disabled') {
        void queryClient.invalidateQueries({ queryKey: ['pos', 'context'] })
      }
      if (failureStatus(error) === undefined && !(error instanceof SessionSuperseded)) {
        connectivity.reportNetworkFailure()
      }
      throw error
    }
  },
  socketToken: async (): Promise<string> => {
    const token = getAuthToken()
    if (token) {
      const exp = tokenExpiryMs(token)
      if (!exp || exp - Date.now() > SOCKET_TOKEN_EXPIRY_MARGIN_MS) return token
    }
    try {
      const refreshed = await adminClient.auth.refresh()
      if (refreshed?.token) {
        adminClient.setToken(refreshed.token)
        return refreshed.token
      }
    } catch {
      if (token) return token
    }
    if (token) return token
    throw new Error('POS session has no access token.')
  },
  abandon: (_generation?: number) => {
    // AuthProvider handles session expiry on 401.
  },
  fetchContext: async <T>(params?: {
    branch_id?: string | null
    register_id?: string | null
  }): Promise<T> => {
    const query: Record<string, string | undefined> = {}
    if (params?.branch_id) query.branch_id = params.branch_id
    if (params?.register_id) query.register_id = params.register_id
    return await session.request<T>('GET', '/pos/context', { params: query })
  },
  resume: async () => {
    // AuthProvider manages token refresh on focus/401.
  },
  restore: async () => snapshot,
  selectStore: (storeId: string) => {
    rememberStore(storeId)
    adminClient.setStore(storeId)
    if (snapshot.storeId !== storeId) {
      snapshot = { ...snapshot, storeId, generation: snapshot.generation + 1 }
      emit()
    }
  },
  logout: async () => {
    clearLayout()
    clearIntents()
    void offlineDb()
      .putSnapshot(null)
      .then(emitOfflineChanged, () => undefined)
    if (authLogout) {
      await authLogout()
    } else {
      try {
        await adminClient.auth.logout()
      } catch {
        // Ignore network errors on logout.
      }
      queryClient.clear()
    }
  },
}
