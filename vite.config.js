import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// Must match GitHub Project Pages path: https://<user>.github.io/party-rooms/
const GITHUB_PAGES_BASE = '/party-rooms/'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: GITHUB_PAGES_BASE,
  plugins: [
    vue(),
    mode === 'development' && vueDevTools(),
    /** Inject <base> here — do NOT use %BASE_URL% in index.html (can ship unreplaced and blank the site). */
    {
      name: 'inject-github-pages-base',
      transformIndexHtml(html) {
        if (/<base\s/i.test(html)) return html
        return html.replace(/<head>/i, `<head>\n    <base href="${GITHUB_PAGES_BASE}" />`)
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
  },
}))
