export class ApiFailure extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) { super(message); }
}
type RequestOptions = { method?: string; body?: unknown; token?: string };

export class ApiClient {
  constructor(private baseUrl: string) {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) {
      throw new Error('API connections require HTTPS except local simulator development.');
    }
  }
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET', signal: controller.signal,
        headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const payload = await response.json();
      if (!response.ok) throw new ApiFailure(response.status, payload.error?.code ?? 'REQUEST_FAILED', payload.error?.message ?? 'Request failed.', Number(response.headers.get('retry-after')) || undefined);
      if (!('data' in payload)) throw new ApiFailure(502, 'INVALID_RESPONSE', 'Unexpected server response.');
      return payload.data as T;
    } catch (error) {
      if (error instanceof ApiFailure) throw error;
      throw new ApiFailure(0, 'NETWORK_ERROR', 'Could not connect. Check the backend and try again.');
    } finally { clearTimeout(timer); }
  }
}
