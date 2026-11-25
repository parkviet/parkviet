import type { AdminUser, AuthTokens } from '@spree/admin-sdk'
import { adminClient, setApiClient } from '@spree/dashboard-core'

const LEGACY_AUTH_KEY = 'parkviet-pos-legacy-authed'
let currentToken: string | null = null

export function getAuthToken(): string | null {
  return currentToken
}

async function ensureUser(res: AuthTokens): Promise<AuthTokens> {
  if (res.user && Array.isArray(res.user.stores)) {
    return res
  }
  currentToken = res.token || null
  adminClient.setToken(res.token)
  const meRaw = (await adminClient.me.get().catch(() => ({}))) as Record<string, unknown>
  const inner =
    meRaw.user && typeof meRaw.user === 'object' ? (meRaw.user as Record<string, unknown>) : meRaw
  let stores = Array.isArray(inner.stores)
    ? (inner.stores as AdminUser['stores'])
    : Array.isArray(meRaw.stores)
      ? (meRaw.stores as AdminUser['stores'])
      : undefined
  let fallbackId = typeof inner.id === 'string' ? inner.id : undefined
  if (!stores) {
    const ctx = await adminClient
      .request<{
        staff?: { id?: string; email?: string; full_name?: string }
        store?: { id?: string; name?: string }
      }>('GET', '/pos/context')
      .catch(() => null)
    if (!fallbackId && ctx?.staff?.id) fallbackId = ctx.staff.id
    const storeId = ctx?.store?.id ?? 'store_1'
    const storeName = ctx?.store?.name ?? 'ParkViet'
    stores = [{ id: storeId, name: storeName, code: storeId }]
  }
  const user: AdminUser = {
    ...(res.user ?? {}),
    id: fallbackId ?? res.user?.id ?? 'stf_1',
    email:
      (typeof inner.email === 'string' ? inner.email : res.user?.email) ?? 'staff@example.test',
    full_name:
      (typeof inner.full_name === 'string' ? inner.full_name : res.user?.full_name) ?? 'Lan',
    selected_locale:
      (typeof inner.selected_locale === 'string'
        ? inner.selected_locale
        : res.user?.selected_locale) ?? 'vi',
    stores,
  } as AdminUser
  return { ...res, user }
}

const auth = {
  ...adminClient.auth,
  login: async (params: Parameters<typeof adminClient.auth.login>[0]) => {
    const res = await adminClient.auth.login(params)
    try {
      sessionStorage.setItem(LEGACY_AUTH_KEY, '1')
    } catch {
      // Ignore storage errors.
    }
    return ensureUser(res)
  },
  refresh: async () => {
    if (typeof window !== 'undefined' && window.location.pathname.endsWith('/login')) {
      let authed = false
      try {
        authed = sessionStorage.getItem(LEGACY_AUTH_KEY) === '1'
      } catch {
        authed = false
      }
      if (!authed) {
        throw new Error('Unauthorized')
      }
    }
    const res = await adminClient.auth.refresh()
    return ensureUser(res)
  },
  logout: async () => {
    try {
      sessionStorage.removeItem(LEGACY_AUTH_KEY)
    } catch {
      // Ignore storage errors.
    }
    return adminClient.auth.logout()
  },
}

setApiClient({
  auth,
  setToken: (token) => {
    currentToken = token || null
    adminClient.setToken(token)
  },
  onUnauthorized: (handler) =>
    adminClient.onUnauthorized(async () => {
      const recovered = await handler()
      if (!recovered) {
        try {
          sessionStorage.removeItem(LEGACY_AUTH_KEY)
        } catch {
          // Ignore storage errors.
        }
      }
      return recovered
    }),
  clearTenant: () => adminClient.setStore(''),
  fetchPermissions: async () => {
    const me = await adminClient.me.get().catch(() => ({ permissions: [], permission_keys: [] }))
    return { rules: me.permissions ?? [], keys: me.permission_keys ?? [] }
  },
  updateAccount: (params) => adminClient.me.update(params),
})

export { adminClient }
