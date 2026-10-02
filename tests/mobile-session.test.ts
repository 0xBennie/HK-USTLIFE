import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProductApp } from '../src/product/app.js';
import { ApiClient, ApiFailure } from '../apps/mobile/src/api.js';
import { SessionController } from '../apps/mobile/src/session.js';

describe('native session contract against HTTP backend', () => {
  let app: ReturnType<typeof createProductApp>;
  let api: ApiClient;
  let dir: string;
  let saved: string | null;
  const storage = { get: async () => saved, set: async (token: string) => { saved = token; }, clear: async () => { saved = null; } };
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'campus-mobile-'));
    saved = null;
    app = createProductApp({ dataDir: dir });
    const url = await app.listen({ host: '127.0.0.1', port: 0 });
    api = new ApiClient(`${url}/api/v1`);
  });
  afterEach(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  async function token(email = 'mobile@example.test') {
    const c = await api.request<{ challenge_id: string }>('/auth/email/challenges', { method: 'POST', body: { email } });
    const code = JSON.parse(readFileSync(join(dir, 'mail', `${c.challenge_id}.json`), 'utf8')).code;
    return (await api.request<{ access_token: string }>('/auth/email/verify', { method: 'POST', body: { challenge_id: c.challenge_id, code } })).access_token;
  }
  it('restores the same persisted account, then revokes it on sign-out', async () => {
    const session = new SessionController(api, storage);
    const access = await token();
    await session.signIn(access);
    expect(session.snapshot().profile?.email).toBe('mobile@example.test');
    const restored = new SessionController(api, storage);
    await restored.restore();
    expect(restored.snapshot().status).toBe('authenticated');
    await restored.signOut();
    expect(saved).toBeNull();
    expect(restored.snapshot()).toMatchObject({ status: 'guest', profile: null });
    await expect(api.request('/me', { token: access })).rejects.toMatchObject({ status: 401 });
  });
  it('clears expired credentials but preserves them on network failure for retry', async () => {
    saved = 'a'.repeat(43);
    const revoked = new SessionController(api, storage);
    await revoked.restore();
    expect(saved).toBeNull();
    expect(revoked.snapshot().status).toBe('guest');
    saved = await token();
    const broken = new ApiClient('http://127.0.0.1:1/api/v1');
    const offline = new SessionController(broken, storage);
    await offline.restore();
    expect(offline.snapshot()).toMatchObject({ status: 'error', profile: null });
    expect(saved).not.toBeNull();
  });
  it('does not repopulate old account data when a delayed restore completes after switching', async () => {
    const old = await token('old@example.test');
    const next = await token('next@example.test');
    let release!: (value: string | null) => void;
    const delayed = { ...storage, get: () => new Promise<string | null>(resolve => { release = resolve; }) };
    const session = new SessionController(api, delayed);
    const restoring = session.restore();
    await session.signIn(next);
    release(old);
    await restoring;
    expect(session.snapshot().profile?.email).toBe('next@example.test');
    expect(saved).toBe(next);
  });
  it('rejects insecure non-local API URLs and returns meaningful error codes', async () => {
    expect(() => new ApiClient('http://example.test/api/v1')).toThrow();
    await expect(api.request('/me')).rejects.toBeInstanceOf(ApiFailure);
    await expect(api.request('/me')).rejects.toMatchObject({ code: 'AUTH_REQUIRED', status: 401 });
  });

  it('discards a private export that arrives after account switching', async () => {
    const first = await token('first@example.test');
    const second = await token('second@example.test');
    let release!: () => void;
    let waiting!: () => void;
    const ready = new Promise<void>(resolve => { waiting = resolve; });
    const original = api.request.bind(api);
    // Delay delivery, not the real HTTP response or authorization behavior.
    api.request = async <T>(path: string, options?: Parameters<ApiClient['request']>[1]) => {
      const value = await original<T>(path, options);
      if (path === '/me/export') { waiting(); await new Promise<void>(resolve => { release = resolve; }); }
      return value;
    };
    const session = new SessionController(api, storage);
    await session.signIn(first);
    const exporting = session.request('/me/export');
    await ready;
    await session.signIn(second);
    const expectation = expect(exporting).rejects.toMatchObject({ code: 'STALE_SESSION' });
    release();
    await expectation;
    expect(session.snapshot().profile?.email).toBe('second@example.test');
  });

  it('passes a stable create key through the native client so network retries do not duplicate tasks', async () => {
    const session = new SessionController(api, storage);
    await session.signIn(await token());
    const options = { method:'POST',body:{kind:'task',title:'From native client'},idempotencyKey:'native-retry-key-001' };
    const first = await session.request<{id:string}>('/study/items',options);
    const retry = await session.request<{id:string}>('/study/items',options);
    expect(retry.id).toBe(first.id);
    const list = await session.request<{items:unknown[]}>('/study/items');
    expect(list.items).toHaveLength(1);
  });
});
