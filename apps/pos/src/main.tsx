import './api-client'
import './i18n'
import './styles.css'
import { createRouter } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { registerServiceWorker } from './counter/lib/service-worker'
import { routeTree } from './routeTree.gen'

const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  defaultPreload: 'intent',
})
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Only the built app installs it: the dev server and its tests stay uncached.
if (import.meta.env.PROD) registerServiceWorker()

createRoot(document.getElementById('root')!).render(<App router={router} />)
