import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import type { TokenEnvironment } from './domain/account-status.js';
import { createMcpServer, type ServerDependencies } from './server.js';

const MAX_REQUEST_BYTES = 1_000_000;

export interface HttpServerOptions extends ServerDependencies {
  port?: number;
  host?: string;
  apiKey?: string;
}

export interface RunningHttpServer {
  url: string;
  close(): Promise<void>;
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function jsonRpcError(response: ServerResponse, status: number, message: string): void {
  json(response, status, { jsonrpc: '2.0', error: { code: -32000, message }, id: null });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_REQUEST_BYTES) {
      throw new RangeError('MCP request body exceeds the 1 MB limit.');
    }
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function isAuthorized(request: IncomingMessage, apiKey: string): boolean {
  return request.headers.authorization === `Bearer ${apiKey}`;
}

async function listen(server: Server, port: number, host: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(port, host, () => {
      server.off('error', onError);
      resolve();
    });
  });
}

export async function startHttpServer(options: HttpServerOptions = {}): Promise<RunningHttpServer> {
  const environment: TokenEnvironment = options.environment ?? {
    HKUST_GRAPH_ACCESS_TOKEN: process.env.HKUST_GRAPH_ACCESS_TOKEN,
    HKUST_MCP_API_KEY: process.env.HKUST_MCP_API_KEY,
  };
  const apiKey = options.apiKey ?? environment.HKUST_MCP_API_KEY;
  if (!apiKey) {
    throw new Error('HKUST_MCP_API_KEY is required for the remote MCP endpoint.');
  }
  if (environment.HKUST_GRAPH_ACCESS_TOKEN) {
    throw new Error('Remote MCP refuses a shared Outlook token. Use stdio for development or implement per-user OAuth before exposing personal signals.');
  }

  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (pathname !== '/mcp') {
      jsonRpcError(response, 404, 'MCP endpoint not found.');
      return;
    }
    if (request.method !== 'POST') {
      jsonRpcError(response, 405, 'Method not allowed. Use POST /mcp.');
      return;
    }
    if (!isAuthorized(request, apiKey)) {
      jsonRpcError(response, 401, 'Unauthorized MCP request.');
      return;
    }

    try {
      const body = await readJsonBody(request);
      const mcpServer = createMcpServer({ ...options, environment });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      response.once('close', () => {
        void transport.close();
        void mcpServer.close();
      });
      await transport.handleRequest(request, response, body);
    } catch (error) {
      if (!response.headersSent) {
        const message = error instanceof RangeError ? error.message : 'Invalid or unsuccessful MCP request.';
        jsonRpcError(response, error instanceof RangeError ? 413 : 400, message);
      }
    }
  });

  const port = options.port ?? 3000;
  const host = options.host ?? '127.0.0.1';
  await listen(server, port, host);
  const address = server.address() as AddressInfo;
  const connectHost = host === '0.0.0.0' ? '127.0.0.1' : host;

  return {
    url: `http://${connectHost}:${address.port}/mcp`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function main(): Promise<void> {
  const running = await startHttpServer();
  console.error(`HKUST Life MCP Streamable HTTP endpoint listening at ${running.url}`);
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  main().catch((error: unknown) => {
    console.error('HKUST Life MCP HTTP endpoint failed to start.', error);
    process.exitCode = 1;
  });
}
