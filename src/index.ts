#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createMcpServer } from './server.js';

async function main(): Promise<void> {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
  console.error('HKUST Life MCP is running on stdio.');
}

main().catch((error: unknown) => {
  console.error('HKUST Life MCP failed to start.', error);
  process.exitCode = 1;
});
