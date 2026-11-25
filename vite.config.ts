import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const productionProjectId = 'webdanhgia-3417e'
const adminUidPlaceholders = new Set(['REPLACE_WITH_ADMIN_UID', 'UID_ADMIN_THAT'])

function readProductionAdminUids(): string {
  const rules = readFileSync(new URL('./firebase/firestore.rules', import.meta.url), 'utf8')
  const declaration = rules.match(/^\s*let adminUids\s*=\s*\[([^\]\r\n]*)\]\s*;/m)
  const uids = declaration?.[1].split(',').map((entry) => entry.trim().match(/^'([A-Za-z0-9_-]{1,128})'$/)?.[1])
  if (!uids?.length || uids.some((uid) => !uid || adminUidPlaceholders.has(uid))) {
    throw new Error('Firebase project webdanhgia-3417e requires a valid adminUids list in firebase/firestore.rules.')
  }
  return uids.join(',')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const configuredUids = (env.VITE_FIREBASE_ADMIN_UIDS ?? '').split(/[\s,]+/).filter(Boolean)
  const useProductionDefaults = env.VITE_FIREBASE_PROJECT_ID === productionProjectId
    && (!configuredUids.length || configuredUids.some((uid) => adminUidPlaceholders.has(uid)))

  return {
    plugins: [react()],
    define: useProductionDefaults ? {
      'import.meta.env.VITE_FIREBASE_ADMIN_UIDS': JSON.stringify(readProductionAdminUids()),
    } : undefined,
  }
})
