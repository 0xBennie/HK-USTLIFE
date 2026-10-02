import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const dataDir = mkdtempSync(join(tmpdir(), 'campus-process-smoke-'));
const port = 14318;
const base = `http://127.0.0.1:${port}/api/v1`;
let processHandle;
let closed;
let processOutput = '';
async function start() {
  processOutput = '';
  processHandle = spawn(process.execPath, ['dist/product/main.js'], {
    env: { ...process.env, CAMPUS_MODE: 'local-development', CAMPUS_PORT: String(port), CAMPUS_DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  closed = new Promise(resolve => processHandle.once('exit', resolve));
  processHandle.stdout.on('data', chunk => { processOutput += chunk; });
  processHandle.stderr.on('data', chunk => { processOutput += chunk; });
  for (let i = 0; i < 100; i++) {
    if (processHandle.exitCode !== null) throw new Error(`Backend failed: ${processOutput}`);
    if (processOutput.includes('LOCAL DEVELOPMENT ONLY:')) return;
    await delay(50);
  }
  throw new Error('Backend startup timed out');
}
async function stop() { if (processHandle?.exitCode === null) { processHandle.kill('SIGTERM'); await closed; } }
async function request(path, { token, body, method = 'GET' } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.ok, true, `${method} ${path}: ${response.status}`);
  return (await response.json()).data;
}
try {
  await start();
  const challenge = await request('/auth/email/challenges', { method: 'POST', body: { email: 'process-smoke@example.test' } });
  const code = JSON.parse(readFileSync(join(dataDir, 'mail', `${challenge.challenge_id}.json`))).code;
  const { access_token: token } = await request('/auth/email/verify', { method: 'POST', body: { challenge_id: challenge.challenge_id, code } });
  await request('/me', { method: 'PATCH', token, body: { display_name: 'Persistence after restart' } });
  await stop();
  await start();
  const restored = await request('/me', { token });
  assert.equal(restored.display_name, 'Persistence after restart');
  assert.equal(restored.membership, 'unknown');
  await request('/auth/logout', { method: 'POST', token });
  assert.equal((await fetch(base + '/me', { headers: { authorization: `Bearer ${token}` } })).status, 401);
  console.log('PASS: real HTTP process start → local challenge → login → edit → process restart → persisted session/profile → logout revoked');
} finally { await stop(); rmSync(dataDir, { recursive: true, force: true }); }
