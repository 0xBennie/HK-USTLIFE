import { ApiClient, ApiFailure, type RequestOptions } from './api';

export type Profile = { id: string; email: string; display_name: string; language: 'zh' | 'en'; role: 'member' | 'admin'; membership: 'unknown'; is_demo: boolean; connections: Record<string, string> };
export type TokenStorage = { get(): Promise<string | null>; set(token: string): Promise<void>; clear(): Promise<void> };
export type SessionState = { status: 'loading' | 'guest' | 'authenticated' | 'error'; profile: Profile | null; error?: string };

export class SessionController {
  private state: SessionState = { status: 'loading', profile: null };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private token: string | null = null;
  private writes: Promise<void> = Promise.resolve();
  constructor(private api: ApiClient, private storage: TokenStorage) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: SessionState) { this.state = state; for (const listener of this.listeners) listener(); }
  private persist(action: () => Promise<void>) { const write = this.writes.then(action); this.writes = write.catch(() => {}); return write; }

  async restore() {
    const epoch = ++this.epoch;
    this.publish({ status: 'loading', profile: null });
    try {
      const token = await this.storage.get();
      if (epoch !== this.epoch) return;
      this.token = token;
      if (!token) { this.publish({ status: 'guest', profile: null }); return; }
      const profile = await this.api.request<Profile>('/me', { token });
      if (epoch === this.epoch) this.publish({ status: 'authenticated', profile });
    } catch (error) {
      if (epoch !== this.epoch) return;
      if (error instanceof ApiFailure && error.status === 401) {
        this.token = null;
        await this.persist(() => this.storage.clear());
        if (epoch === this.epoch) this.publish({ status: 'guest', profile: null });
      } else this.publish({ status: 'error', profile: null, error: error instanceof ApiFailure ? error.code : 'STORAGE_ERROR' });
    }
  }

  async signIn(token: string) {
    const epoch = ++this.epoch;
    this.publish({ status: 'loading', profile: null });
    try {
      const profile = await this.api.request<Profile>('/me', { token });
      if (epoch !== this.epoch) return;
      await this.persist(() => this.storage.set(token));
      if (epoch !== this.epoch) return;
      this.token = token;
      this.publish({ status: 'authenticated', profile });
    } catch (error) {
      if (epoch === this.epoch) this.publish({ status: 'error', profile: null, error: error instanceof ApiFailure ? error.code : 'STORAGE_ERROR' });
      throw error;
    }
  }

  async request<T>(path: string, options: Omit<RequestOptions,'token'> = {}) {
    const epoch = this.epoch;
    try {
      const result = await this.api.request<T>(path, { ...options, token: this.token ?? undefined });
      if (epoch !== this.epoch) throw new ApiFailure(409, 'STALE_SESSION', 'The account changed while the request was running.');
      return result;
    }
    catch (error) {
      if (epoch === this.epoch && error instanceof ApiFailure && error.status === 401) {
        ++this.epoch;
        this.token = null;
        this.publish({ status: 'guest', profile: null });
        await this.persist(() => this.storage.clear());
      }
      throw error;
    }
  }

  async updateProfile(body: { display_name?: string; language?: 'zh' | 'en' }) {
    const epoch = this.epoch;
    const profile = await this.request<Profile>('/me', { method: 'PATCH', body });
    if (epoch === this.epoch) this.publish({ status: 'authenticated', profile });
  }
  async signOut() {
    const epoch = ++this.epoch;
    if (this.token) {
      try { await this.api.request('/auth/logout', { method: 'POST', token: this.token }); }
      catch (error) { if (!(error instanceof ApiFailure && error.status === 401)) throw error; }
    }
    if (epoch !== this.epoch) return;
    this.token = null;
    await this.persist(() => this.storage.clear());
    if (epoch === this.epoch) this.publish({ status: 'guest', profile: null });
  }
  async deleteAccount() {
    await this.request('/me', { method: 'DELETE', body: { confirmation: 'DELETE' } });
    ++this.epoch;
    this.token = null;
    await this.persist(() => this.storage.clear());
    this.publish({ status: 'guest', profile: null });
  }
}
