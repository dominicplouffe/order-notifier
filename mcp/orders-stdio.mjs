// Run with: node mcp/orders-stdio.mjs
// stdio transport: one JSON message per line on stdin, one per line on stdout.
// stdout is the protocol. Anything else you want to print goes to stderr.
import { createInterface } from 'node:readline';
import { handle, trace } from './orders-core.mjs';

createInterface({ input: process.stdin }).on('line', (line) => {
  if (!line.trim()) return;
  const msg = JSON.parse(line);
  trace('<-', msg);
  const reply = handle(msg);
  if (reply) {
    trace('->', reply);
    process.stdout.write(JSON.stringify(reply) + '\n');
  }
});
