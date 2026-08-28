import { describe, expect, it } from 'vitest';

import { handlePublicMcp } from '../apps/hub/app/api/mcp/route.js';
import { GET as health } from '../apps/hub/app/api/health/route.js';

const initializeRequest = new Request('http://hub.test/api/mcp', {
  method: 'POST',
  headers: {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'hub-test', version: '0.1.0' } },
  }),
});

describe('public HKUST MCP route', () => {
  it('initializes a stateless public-only MCP server', async () => {
    const response = await handlePublicMcp(initializeRequest);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('hkust-life-mcp');
  });

  it('keeps public health independent from private connectors', async () => {
    expect(await (await health()).json()).toEqual({ status: 'ok', scope: 'clear-water-bay-public' });
  });

  it('rejects oversized requests before parsing JSON-RPC', async () => {
    const response = await handlePublicMcp(new Request('http://hub.test/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: 'x'.repeat(1_000_001),
    }));

    expect(response.status).toBe(413);
  });
});
