import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// The service worker of the built app: it keeps the files of this build so
// the POS opens with the server out of reach (pages from the network first,
// files from the cache), and lets every API and socket request through
// untouched. Each build gets its own cache; a new one waits for the cashier
// to reload (src/counter/lib/service-worker.ts).
function serviceWorkerSource(version: string, files: string[]) {
  return `const CACHE = 'parkviet-pos-${version}';
const FILES = ${JSON.stringify(files)};
const scope = () => new URL(self.registration.scope);
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('parkviet-pos-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scope().pathname)) return;
  if (/^/(api|cable|rails)(/|$)/.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(new URL('index.html', scope()).href, { cacheName: CACHE }).then((hit) => hit || Response.error()),
      ),
    );
    return;
  }
  event.respondWith(caches.match(request, { cacheName: CACHE }).then((hit) => hit || fetch(request)));
});
`
}

function serviceWorker(): Plugin {
  return {
    name: 'parkviet-pos-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = [
        ...new Set(['index.html', ...Object.keys(bundle)].filter((name) => !name.endsWith('.map'))),
      ].sort()
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorkerSource(version, files),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:3000'
  const proxy = {
    '/api': { target, changeOrigin: true },
    '/rails': { target, changeOrigin: true },
    ...(process.env.POS_CABLE_PROXY === 'off'
      ? {}
      : {
          '/cable': {
            target,
            changeOrigin: true,
            ws: true,
          },
        }),
  }
  return {
    base: process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || '/',
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
        codeSplittingOptions: {
          splitBehavior: ({ routeId }) => (routeId === '/offline' ? [] : undefined),
        },
      }),
      tailwindcss(),
      react(),
      serviceWorker(),
    ],
    resolve: {
      alias: {
        '@shared': resolve(import.meta.dirname, 'src/shared'),
      },
      dedupe: [
        'react',
        'react-dom',
        'i18next',
        'react-i18next',
        '@tanstack/react-query',
        '@tanstack/react-router',
      ],
    },
    server: {
      port: 5175,
      strictPort: true,
      proxy,
    },
    preview: {
      port: 5175,
      strictPort: true,
      proxy,
    },
  }
})
