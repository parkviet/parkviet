type DashboardLocation = {
  baseUrl?: string
  basePath?: string
  development?: boolean
  origin?: string
}

const currentLocation = (): DashboardLocation => ({
  baseUrl: import.meta.env.VITE_POS_DASHBOARD_URL,
  basePath: import.meta.env.BASE_URL,
  development: import.meta.env.DEV,
  origin: globalThis.location?.origin,
})

const cleanBasePath = (value?: string) => (value ?? '/').replace(/\/+$/, '')

// When an explicit external baseUrl is passed (e.g. in tests or custom mounts),
// honour it; otherwise resolve against the current app's own base path.
function dashboardBase(location: DashboardLocation): URL | null {
  const configured = location.baseUrl?.trim()
  const base = configured || `${cleanBasePath(location.basePath)}/`
  const sameOrigin = base.startsWith('/') && !base.startsWith('//')
  if (sameOrigin && !location.origin) {
    return new URL(base, 'http://localhost')
  }
  try {
    const url = sameOrigin ? new URL(base, location.origin) : new URL(base)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    url.search = ''
    url.hash = ''
    return url
  } catch {
    return null
  }
}

const basePathOf = (url: URL) => url.pathname.replace(/\/+$/, '')

function formatUrl(url: URL, location: DashboardLocation): string {
  const configured = location.baseUrl?.trim()
  if (configured && !configured.startsWith('/')) return url.toString()
  if (location.origin) return url.toString()
  return `${url.pathname}${url.search}`
}

export function posDashboardHomeUrl(
  location: DashboardLocation = currentLocation(),
): string | null {
  const url = dashboardBase(location)
  if (!url) return null
  url.pathname = `${basePathOf(url)}/`
  return formatUrl(url, location)
}

export function posDashboardUrl(
  storeId: string | null | undefined,
  path = '',
  branchId?: string | null,
  location: DashboardLocation = currentLocation(),
): string | null {
  if (!storeId || storeId === '.' || storeId === '..') return null
  const url = dashboardBase(location)
  if (!url) return null
  const segments = path.split('/').filter(Boolean)
  if (segments.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) return null
  url.pathname = `${basePathOf(url)}/${encodeURIComponent(storeId)}${segments.length ? `/${segments.join('/')}` : ''}`
  if (branchId) url.searchParams.set('branch', branchId)
  return formatUrl(url, location)
}

export function withSearch(url: string | null, search: Record<string, string>): string | null {
  if (!url) return null
  const hasOrigin = /^https?:\/\//i.test(url)
  const next = hasOrigin ? new URL(url) : new URL(url, 'http://localhost')
  for (const [key, value] of Object.entries(search)) next.searchParams.set(key, value)
  return hasOrigin ? next.toString() : `${next.pathname}${next.search}`
}
