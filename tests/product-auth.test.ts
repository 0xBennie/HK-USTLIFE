import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProductApp } from '../src/product/app.js';
import { loadLocalConfig } from '../src/product/config.js';
import { seedDevelopmentAccounts } from '../src/product/seed.js';

describe('persistent product account API', () => {
  let dir: string;
  let time: number;
  let app: ReturnType<typeof createProductApp>;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'campus-account-'));
    time = Date.parse('2026-10-02T08:00:00Z');
    app = createProductApp({ dataDir: dir, now: () => time });
  });
  afterEach(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
  async function challenge(email = 'one@example.test') {
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/email/challenges', payload: { email } });
    expect(r.statusCode).toBe(202);
    expect(r.json().data.code).toBeUndefined();
    const id = r.json().data.challenge_id as string;
    const mail = JSON.parse(readFileSync(join(dir, 'mail', `${id}.json`), 'utf8'));
    return { id, code: mail.code as string };
  }
  async function verify(c: { id: string; code: string }) {
    return app.inject({ method: 'POST', url: '/api/v1/auth/email/verify', payload: { challenge_id: c.id, code: c.code } });
  }
  async function login(email = 'one@example.test') {
    const r = await verify(await challenge(email));
    expect(r.statusCode).toBe(200);
    return r.json().data.access_token as string;
  }

  it('keeps a platform account distinct from unverified school membership and private connections', async () => {
    const methods = await app.inject({ url: '/api/v1/auth/methods' });
    expect(methods.json().data.school_sso.status).toBe('approval_required');
    const token = await login('Student@connect.ust.hk');
    const me = await app.inject({ url: '/api/v1/me', headers: bearer(token) });
    expect(me.json().data).toMatchObject({ email: 'student@connect.ust.hk', membership: 'unknown', role: 'member', is_demo: true });
    expect(me.headers['cache-control']).toBe('no-store');
    expect(me.json().data.connections.canvas).toBe('not_connected'); // Canvas connects with the student's own access token
  });

  it('accepts only HKUST email domains (plus the local test domain)', async () => {
    for (const email of ['someone@gmail.com', 'x@ust.hk.evil.com', 'y@connectust.hk']) {
      const r = await app.inject({ method: 'POST', url: '/api/v1/auth/email/challenges', payload: { email } });
      expect(r.statusCode).toBe(422);
      expect(r.json().error.code).toBe('EMAIL_DOMAIN_NOT_ALLOWED');
    }
    for (const email of ['s1@connect.ust.hk', 'staff@ust.hk', 'dev@example.test']) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/auth/email/challenges', payload: { email } })).statusCode).toBe(202);
    }
  });

  it('consumes a code once even for concurrent requests and never persists raw sessions', async () => {
    const c = await challenge();
    const attempts = await Promise.all([verify(c), verify(c)]);
    expect(attempts.map(r => r.statusCode).sort()).toEqual([200, 410]);
    const token = attempts.find(r => r.statusCode === 200)!.json().data.access_token;
    await app.close();
    const db = readFileSync(join(dir, 'campus.sqlite'));
    expect(db.includes(token)).toBe(false);
    app = createProductApp({ dataDir: dir, now: () => time });
    expect((await app.inject({ url: '/api/v1/me', headers: bearer(token) })).statusCode).toBe(200);
    expect(readdirSync(join(dir, 'mail'))).toHaveLength(0);
  });

  it('blocks guessing after five attempts and expires codes after ten minutes', async () => {
    const c = await challenge();
    const wrong = c.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) expect((await verify({ ...c, code: wrong })).statusCode).toBe(401);
    expect((await verify(c)).statusCode).toBe(410);
    const expired = await challenge('two@example.test');
    time += 600_000;
    expect((await verify(expired)).statusCode).toBe(410);
  });

  it('enforces email cooldown across normalization and an IP-wide budget', async () => {
    await challenge('one@example.test');
    const retry = await app.inject({ method: 'POST', url: '/api/v1/auth/email/challenges', payload: { email: ' ONE@example.test ' } });
    expect(retry.statusCode).toBe(429);
    expect(retry.headers['retry-after']).toBe('60');
    for (let i = 0; i < 9; i++) await challenge(`other${i}@example.test`);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/email/challenges', payload: { email: 'last@example.test' } })).statusCode).toBe(429);
  });

  it('isolates profiles, blocks role escalation and survives database restart', async () => {
    const one = await login();
    const two = await login('two@example.test');
    const update = await app.inject({ method: 'PATCH', url: '/api/v1/me', headers: bearer(one), payload: { display_name: '海边读书', language: 'en' } });
    expect(update.statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: '/api/v1/me', headers: bearer(one), payload: { role: 'admin' } })).statusCode).toBe(400);
    expect((await app.inject({ url: '/api/v1/admin/status', headers: bearer(one) })).statusCode).toBe(403);
    const id = update.json().data.id;
    expect((await app.inject({ url: `/api/v1/users/${id}/export`, headers: bearer(two) })).statusCode).toBe(404);
    await app.close();
    app = createProductApp({ dataDir: dir, now: () => time });
    const mine = (await app.inject({ url: '/api/v1/me/export', headers: bearer(one) })).json().data;
    const theirs = (await app.inject({ url: '/api/v1/me/export', headers: bearer(two) })).json().data;
    expect(mine.profile.display_name).toBe('海边读书');
    expect(theirs.profile.email).toBe('two@example.test');
    expect(JSON.stringify(theirs)).not.toContain('海边读书');
  });

  it('revokes logout immediately and enforces idle and absolute expiry', async () => {
    const token = await login();
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: bearer(token) })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/v1/me', headers: bearer(token) })).statusCode).toBe(401);
    const idle = await login('idle@example.test');
    time += 30 * 60_000;
    expect((await app.inject({ url: '/api/v1/me', headers: bearer(idle) })).statusCode).toBe(401);
    const absolute = await login('absolute@example.test');
    for (let i = 0; i < 71; i++) {
      time += 10 * 60_000;
      expect((await app.inject({ url: '/api/v1/me', headers: bearer(absolute) })).statusCode).toBe(200);
    }
    time += 10 * 60_000;
    expect((await app.inject({ url: '/api/v1/me', headers: bearer(absolute) })).statusCode).toBe(401);
  });

  it('requires explicit recent confirmation then deletes account, sessions, and challenges', async () => {
    const token = await login();
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/me', headers: bearer(token), payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/me', headers: bearer(token), payload: { confirmation: 'DELETE' } })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/v1/me', headers: bearer(token) })).statusCode).toBe(401);
    time += 60_000;
    const newToken = await login();
    time += 11 * 60_000;
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/me', headers: bearer(newToken), payload: { confirmation: 'DELETE' } })).statusCode).toBe(403);
  });

  it('rejects unauthenticated/private access, malformed inputs, hostile origins and oversized bodies', async () => {
    expect((await app.inject({ url: '/api/v1/me' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/me', headers: { origin: 'https://evil.test' } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/v1/auth/methods', headers: { host: 'evil.test' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/email/challenges', payload: { email: 'not an email' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/email/challenges', payload: { email: 'x'.repeat(40_000) } })).statusCode).toBe(413);
    expect((await app.inject({ url: '/mail' })).statusCode).toBe(404);
  });

  it('requires explicit local mode and refuses production or public binding', () => {
    expect(() => loadLocalConfig({})).toThrow();
    expect(() => loadLocalConfig({ CAMPUS_MODE: 'local-development', NODE_ENV: 'production' })).toThrow();
    expect(() => loadLocalConfig({ CAMPUS_MODE: 'local-development', CAMPUS_HOST: '0.0.0.0' })).toThrow();
    expect(loadLocalConfig({ CAMPUS_MODE: 'local-development' }).host).toBe('127.0.0.1');
  });

  it('provisions a restricted development admin idempotently outside the public API', async () => {
    seedDevelopmentAccounts(dir);
    seedDevelopmentAccounts(dir);
    const admin = await login('admin@example.test');
    expect((await app.inject({ url: '/api/v1/admin/status', headers: bearer(admin) })).statusCode).toBe(200);
    const user = await login('student-a@example.test');
    expect((await app.inject({ url: '/api/v1/admin/status', headers: bearer(user) })).statusCode).toBe(403);
  });

  it('invalidates older codes when requesting a replacement', async () => {
    const old = await challenge();
    time += 60_000;
    const replacement = await challenge();
    expect((await verify(old)).statusCode).toBe(410);
    expect((await verify(replacement)).statusCode).toBe(200);
  });
});
