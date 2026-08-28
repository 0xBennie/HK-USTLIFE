import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp';

import { createMcpServer } from '../../../../../dist/server.js';

const maxRequestBytes = 1_000_000;

export const runtime = 'nodejs';

function jsonRpcError(status: number, code: number, message: string): Response {
  return Response.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status });
}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    throw new RangeError('MCP request body exceeds the 1 MB limit.');
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxRequestBytes) {
    throw new RangeError('MCP request body exceeds the 1 MB limit.');
  }

  return JSON.parse(body);
}

/** Public, stateless transport: every request gets a public-mode server with no student credentials. */
export async function handlePublicMcp(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonRpcError(405, -32000, 'Method not allowed. Use POST /api/mcp.');
  }

  let parsedBody: unknown;
  try {
    parsedBody = await readJson(request);
  } catch (error) {
    return jsonRpcError(
      error instanceof RangeError ? 413 : 400,
      error instanceof RangeError ? -32000 : -32700,
      error instanceof RangeError ? error.message : 'Invalid JSON MCP request.',
    );
  }

  const mcpServer = createMcpServer({ mode: 'public' });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await mcpServer.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody });
    const body = await response.arrayBuffer();
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'no-store');
    return new Response(body, { status: response.status, headers });
  } catch {
    return jsonRpcError(400, -32000, 'Invalid or unsuccessful MCP request.');
  } finally {
    await transport.close();
    await mcpServer.close();
  }
}

export async function POST(request: Request): Promise<Response> {
  return handlePublicMcp(request);
}
