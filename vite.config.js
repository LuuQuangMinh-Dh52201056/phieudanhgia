import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
var productionProjectId = 'webdanhgia-3417e';
var adminUidPlaceholders = new Set(['REPLACE_WITH_ADMIN_UID', 'UID_ADMIN_THAT']);
function readProductionAdminUids() {
    var rules = readFileSync(new URL('./firebase/firestore.rules', import.meta.url), 'utf8');
    var declaration = rules.match(/^\s*let adminUids\s*=\s*\[([^\]\r\n]*)\]\s*;/m);
    var uids = declaration === null || declaration === void 0 ? void 0 : declaration[1].split(',').map(function (entry) { var _a; return (_a = entry.trim().match(/^'([A-Za-z0-9_-]{1,128})'$/)) === null || _a === void 0 ? void 0 : _a[1]; });
    if (!(uids === null || uids === void 0 ? void 0 : uids.length) || uids.some(function (uid) { return !uid || adminUidPlaceholders.has(uid); })) {
        throw new Error('Firebase project webdanhgia-3417e requires a valid adminUids list in firebase/firestore.rules.');
    }
    return uids.join(',');
}
export default defineConfig(function (_a) {
    var _b;
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd());
    var configuredUids = ((_b = env.VITE_FIREBASE_ADMIN_UIDS) !== null && _b !== void 0 ? _b : '').split(/[\s,]+/).filter(Boolean);
    var useProductionDefaults = env.VITE_FIREBASE_PROJECT_ID === productionProjectId
        && (!configuredUids.length || configuredUids.some(function (uid) { return adminUidPlaceholders.has(uid); }));
    return {
        plugins: [react()],
        define: useProductionDefaults ? {
            'import.meta.env.VITE_FIREBASE_ADMIN_UIDS': JSON.stringify(readProductionAdminUids()),
        } : undefined,
    };
});
