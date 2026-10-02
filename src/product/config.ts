import { resolve } from 'node:path';

export function loadLocalConfig(env: Record<string, string | undefined>) {
  if (env.CAMPUS_MODE !== 'local-development' || env.NODE_ENV === 'production') {
    throw new Error('This MVP requires explicit CAMPUS_MODE=local-development; production mail and hosting are not configured.');
  }
  const host = env.CAMPUS_HOST ?? '127.0.0.1';
  if (host !== '127.0.0.1') throw new Error('Development authentication must bind to 127.0.0.1.');
  const port = Number(env.CAMPUS_PORT ?? 4318);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid CAMPUS_PORT');
  return { host, port, dataDir: resolve(env.CAMPUS_DATA_DIR ?? '.local/campus') };
}
