import { adminClient, setApiClient } from '@spree/dashboard-core'

let currentToken: string | null = null

export function getAuthToken(): string | null {
  return currentToken
}

setApiClient({
  auth: adminClient.auth,
  setToken: (token) => {
    currentToken = token || null
    adminClient.setToken(token)
  },
  onUnauthorized: (handler) => adminClient.onUnauthorized(handler),
  clearTenant: () => adminClient.setStore(''),
  fetchPermissions: async () => {
    const me = await adminClient.me.get()
    return { rules: me.permissions, keys: me.permission_keys ?? [] }
  },
  updateAccount: (params) => adminClient.me.update(params),
})

export { adminClient }
