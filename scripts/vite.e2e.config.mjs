import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const mockFile = (name) => fileURLToPath(new URL(`./mocks/${name}.mjs`, import.meta.url))

// Use this config explicitly for E2E. Production keeps its real store modules.
export default defineConfig({
  root: projectRoot,
  plugins: [
    {
      name: 'memory-only-e2e',
      enforce: 'pre',
      resolveId(source) {
        if (/^(?:@?firebase)(?:\/|$)/.test(source) || /(?:^|\/)lib\/firebase(?:\.ts)?$/.test(source)) {
          throw new Error(`E2E must not import Firebase: ${source}`)
        }
      },
      transformIndexHtml() {
        return [{ tag: 'meta', attrs: { name: 'e2e-store', content: 'memory-only' }, injectTo: 'head' }]
      },
      configureServer(server) {
        server.middlewares.use('/__e2e_mock_mode', (_request, response) => {
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ store: 'memory-only' }))
        })
      },
    },
    react(),
  ],
  resolve: {
    alias: [
      {
        find: /^(?:\.\.\/|\.\/)services\/adminAuthStore$/,
        replacement: mockFile('adminAuthStore'),
      },
      {
        find: /^(?:\.\.\/|\.\/)services\/trainingDirectoryStore$/,
        replacement: mockFile('trainingDirectoryStore'),
      },
      {
        find: /^(?:\.\.\/|\.\/)services\/evaluationAdminStore$/,
        replacement: mockFile('evaluationAdminStore'),
      },
    ],
  },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: 'dist-e2e' },
})
