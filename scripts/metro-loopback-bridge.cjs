// Expo may advertise IPv4 while --localhost Metro binds IPv6 on macOS.
// Task-local development helper; binds ONLY loopback. Stop with Ctrl-C.
const net = require('node:net');
const port = Number(process.argv[2] || 8087);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Expected port 1024–65535');
const server = net.createServer(client => {
  const upstream = net.connect({ host: '::1', port });
  client.pipe(upstream).pipe(client);
  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Metro loopback bridge 127.0.0.1:${port} -> [::1]:${port}`));
