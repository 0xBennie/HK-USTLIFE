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
async function request(path, { token, body, method = 'GET', key } = {}) {
  const response = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...(key ? {'idempotency-key':key} : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.ok, true, `${method} ${path}: ${response.status}`);
  return (await response.json()).data;
}
try {
  await start();
  const challenge = await request('/auth/email/challenges', { method: 'POST', body: { email: 'process-smoke@example.test' } });
  const code = JSON.parse(readFileSync(join(dataDir, 'mail', `${challenge.challenge_id}.json`))).code;
  const { access_token: token } = await request('/auth/email/verify', { method: 'POST', body: { challenge_id: challenge.challenge_id, code } });
  await request('/me', { method: 'PATCH', token, body: { display_name: 'Persistence after restart' } });
  const course=await request('/study/courses',{method:'POST',token,key:'process-course-001',body:{title:'Process smoke course'}});
  const task=await request('/study/items',{method:'POST',token,key:'process-task-001',body:{kind:'task',title:'Read before class',course_id:course.id,due_date:'2026-10-05'}});
  await request('/study/items',{method:'POST',token,key:'process-note-001',body:{kind:'note',title:'Private note',body:'Retain after restart',course_id:course.id}});
  await request('/study/items',{method:'POST',token,key:'process-event-001',body:{kind:'event',title:'Class',starts_at:'2026-10-05T09:00:00+08:00',course_id:course.id}});
  await stop();
  await start();
  const restored = await request('/me', { token });
  assert.equal(restored.display_name, 'Persistence after restart');
  assert.equal(restored.membership, 'unknown');
  const calendar=await request('/me/calendar?from=2026-10-05&to=2026-10-06',{token});
  assert.equal(calendar.days[0].events[0].title,'Class');
  assert.equal(calendar.days[0].tasks[0].due_at,null);
  const changed=await request(`/study/items/${task.id}`,{method:'PATCH',token,body:{version:1,status:'done'}});
  assert.equal(changed.version,2);
  const exported=await request('/me/export',{token});
  assert.equal(exported.learning.items.length,3);
  assert.equal(exported.learning.items.find(i=>i.kind==='note').body,'Retain after restart');
  await request('/auth/logout', { method: 'POST', token });
  assert.equal((await fetch(base + '/me', { headers: { authorization: `Bearer ${token}` } })).status, 401);
  console.log('PASS: real HTTP process start → local challenge → login → profile/course/event/task/note writes → process restart → persisted calendar/profile → task completed/versioned → private export → logout revoked');
} finally { await stop(); rmSync(dataDir, { recursive: true, force: true }); }
