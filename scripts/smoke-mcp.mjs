import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TIMEOUT_MS = 10_000;

function waitForResponse(child, id, pending, stderr) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for MCP response ${id}. Server stderr: ${stderr.value}`));
    }, TIMEOUT_MS);

    pending.set(id, (message) => {
      clearTimeout(timeout);
      if (message.error) {
        reject(new Error(`MCP request ${id} failed: ${message.error.message ?? 'unknown error'}`));
        return;
      }
      resolve(message.result);
    });
  });
}

export async function runMcpSmokeCheck() {
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const pending = new Map();
  const stderr = { value: '' };
  let stdoutBuffer = '';

  child.stderr.on('data', (chunk) => {
    stderr.value += chunk.toString();
  });
  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const resolve = pending.get(message.id);
      if (resolve) {
        pending.delete(message.id);
        resolve(message);
      }
    }
  });

  try {
    const initialize = waitForResponse(child, 1, pending, stderr);
    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'hkust-life-smoke', version: '0.1.0' },
      },
    })}\n`);
    await initialize;

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    const toolList = waitForResponse(child, 2, pending, stderr);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
    const result = await toolList;

    return result.tools.map((tool) => tool.name);
  } finally {
    child.kill();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runMcpSmokeCheck()
    .then((names) => console.log(`MCP smoke check passed: ${names.join(', ')}`))
    .catch((error) => {
      console.error('MCP smoke check failed.', error);
      process.exitCode = 1;
    });
}
