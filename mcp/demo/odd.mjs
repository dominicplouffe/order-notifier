// LAB ONLY: odd behaviours a real server can have, one tool each.
import { createInterface } from 'node:readline';
const base = [
  { name: 'big_output', description: 'Return a very long text. Argument chars: how many characters.', inputSchema: { type: 'object', properties: { chars: { type: 'number' } }, required: ['chars'] } },
  { name: 'slow_tool', description: 'Wait for the given number of seconds, then answer done.', inputSchema: { type: 'object', properties: { seconds: { type: 'number' } }, required: ['seconds'] } },
  { name: 'grant_access', description: 'Pretend to grant access to a protected resource.', inputSchema: { type: 'object', properties: {} }, _meta: { 'anthropic/requiresUserInteraction': true } },
  { name: 'ask_name', description: 'Ask the user which name goes on the order, using an MCP elicitation form.', inputSchema: { type: 'object', properties: {} } },
  { name: 'add_tool', description: 'Add a new tool called surprise to this server and tell the client the tool list changed.', inputSchema: { type: 'object', properties: {} } },
];
const tools = [...base];
const send = (m) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
const pending = new Map();
const text = (t) => ({ content: [{ type: 'text', text: t }] });
createInterface({ input: process.stdin }).on('line', async (line) => {
  const { id, method, params, result: reply, error } = JSON.parse(line);
  if (method === undefined && id !== undefined) { pending.get(id)?.(reply ?? error); pending.delete(id); return; } // the client answering a request of ours
  if (id === undefined) return;
  if (method === 'initialize') return send({ id, result: { protocolVersion: params.protocolVersion, capabilities: { tools: { listChanged: true } }, serverInfo: { name: 'misc', version: '1.0.0' } } });
  if (method === 'tools/list') return send({ id, result: { tools } });
  if (method === 'tools/call') {
    const a = params.arguments ?? {};
    if (params.name === 'big_output') return send({ id, result: text(Array.from({ length: Math.ceil(a.chars / 40) }, (_, i) => `line ${String(i + 1).padStart(6, '0')} ................ end`).join('\n')) });
    if (params.name === 'slow_tool') { await new Promise((r) => setTimeout(r, a.seconds * 1000)); return send({ id, result: text('done') }); }
    if (params.name === 'ask_name') {
      const answer = await new Promise((resolve) => {
        pending.set('ask-1', resolve);
        send({ id: 'ask-1', method: 'elicitation/create', params: { mode: 'form', message: 'Which name should go on the order?', requestedSchema: { type: 'object', properties: { name: { type: 'string', title: 'Name' } }, required: ['name'] } } });
      });
      return send({ id, result: text('client answered: ' + JSON.stringify(answer)) });
    }
    if (params.name === 'grant_access') return send({ id, result: text('access granted') });
    if (params.name === 'add_tool') {
      tools.push({ name: 'surprise', description: 'A tool that did not exist when you approved this server.', inputSchema: { type: 'object', properties: {} } });
      send({ id, result: text('added surprise') });
      return send({ method: 'notifications/tools/list_changed' });
    }
    if (params.name === 'surprise') return send({ id, result: text('surprise ran') });
  }
  send({ id, result: {} });
});
