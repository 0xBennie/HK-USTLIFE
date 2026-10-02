import { createProductApp } from './app.js';
import { loadLocalConfig } from './config.js';

const config = loadLocalConfig(process.env);
const app = createProductApp(config);
await app.listen({ host: config.host, port: config.port });
console.log(`LOCAL DEVELOPMENT ONLY: http://${config.host}:${config.port}/api/v1`);
console.log(`Test login codes are files in ${config.dataDir}/mail; no email is sent.`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => { await app.close(); process.exit(0); });
