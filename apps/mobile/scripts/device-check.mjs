import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
// Match Expo's .env loading before inspecting the public Metro configuration.
process.env.NODE_ENV ??= 'development';
require('@expo/env').load(root);
const { getConfig } = require('@expo/config');
const { exp } = getConfig(root);
const eas = JSON.parse(readFileSync(resolve(root, 'eas.json'), 'utf8'));
const profile = eas.build?.development;
let failures = 0;
const check = (ok, message) => {
  console.log(`${ok ? 'OK' : 'NEEDS SETUP'}: ${message}`);
  if (!ok) failures++;
};
check(Boolean(require.resolve('expo-dev-client')), 'Expo development client installed');
check(profile?.developmentClient === true && profile?.distribution === 'internal'
  && profile?.ios?.simulator === false, 'Development profile targets a physical iPhone');
check(Boolean(exp.extra?.eas?.projectId), 'Expo project linked (eas init after login)');
check(Boolean(exp.ios?.bundleIdentifier), 'iOS bundle identifier configured; Apple registration still requires verification');

let reachableCandidate = false;
try {
  const url = new URL(process.env.EXPO_PUBLIC_API_URL ?? '');
  const host = url.hostname.toLowerCase();
  reachableCandidate = url.protocol === 'https:' && !url.username && !url.password
    && !url.search && !url.hash && !['localhost', '[::1]', '0.0.0.0'].includes(host)
    && !host.startsWith('127.') && !host.endsWith('.localhost')
    && url.pathname.replace(/\/$/, '') === '/api/v1';
} catch { /* Missing or malformed URL is a setup requirement, never a loopback fallback. */ }
check(reachableCandidate, 'EXPO_PUBLIC_API_URL points to a configured HTTPS /api/v1 backend, not phone loopback');
console.log('This checks configuration only, not account login, signing, server reachability or iPhone runtime.');
console.log('Do not publish the current loopback-only development authentication server to satisfy this check.');
process.exitCode = failures ? 1 : 0;
