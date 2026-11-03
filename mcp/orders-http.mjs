// Run with: ORDERS_MCP_TOKEN=secret node mcp/orders-http.mjs
// HTTP transport: Claude Code POSTs each JSON message to /mcp and reads the JSON reply.
import { createServer } from 'node:http';
import { handle, trace } from './orders-core.mjs';

const token = process.env.ORDERS_MCP_TOKEN;
const port = Number(process.env.ORDERS_MCP_PORT || 3333);

createServer((req, res) => {
  if (req.url !== '/mcp') { res.writeHead(404).end(); return; }
  if (token && req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(401, { 'www-authenticate': 'Bearer' }).end();
    return;
  }
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    const msg = JSON.parse(body);
    trace('<-', msg);
    const reply = handle(msg);
    if (!reply) { res.writeHead(202).end(); return; } // a notification: nothing to say back
    trace('->', reply);
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(reply));
  });
}).listen(port, '127.0.0.1', () => console.error(`orders MCP on http://127.0.0.1:${port}/mcp`));
