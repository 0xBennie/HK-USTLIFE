import { describe, expect, it } from 'vitest';

import { startHttpServer } from '../src/http.js';

async function parseMcpResponse(response: Response): Promise<unknown> {
  const body = await response.text();
  const dataLine = body.split('\n').find((line) => line.startsWith('data:'));
  return JSON.parse(dataLine ? dataLine.slice('data:'.length).trim() : body);
}

describe('Streamable HTTP MCP transport', () => {
  it('requires its configured bearer secret and completes an MCP initialize request', async () => {
    const running = await startHttpServer({
      port: 0,
      apiKey: 'test-server-secret',
      environment: {},
    });
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'transport-test', version: '0.1.0' },
      },
    };

    try {
      const rejected = await fetch(running.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify(request),
      });
      const accepted = await fetch(running.url, {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-server-secret',
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(request),
      });

      expect(rejected.status).toBe(401);
      expect(accepted.status).toBe(200);
      await expect(parseMcpResponse(accepted)).resolves.toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: { serverInfo: { name: 'hkust-life-mcp', version: '0.1.0' } },
      });
    } finally {
      await running.close();
    }
  });
});
