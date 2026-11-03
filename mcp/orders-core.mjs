// What the order-notifier MCP server offers, as plain functions.
// No transport in here: orders-stdio.mjs and orders-http.mjs carry the messages.
import { appendFileSync } from 'node:fs';
import { buildNotification, validateOrder } from '../src/orders.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig();
const orderSchema = {
  type: 'object',
  properties: { order: { type: 'object', description: 'An order: id, customerEmail, amountCents' } },
  required: ['order'],
};

export const tools = [
  {
    name: 'check_order',
    description: 'Check an order against the same rules POST /orders uses. Changes nothing.',
    inputSchema: orderSchema,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'preview_notification',
    description: 'Show the confirmation email an order would produce. Sends nothing.',
    inputSchema: orderSchema,
    annotations: { readOnlyHint: true },
  },
  {
    name: 'queue_notification',
    description: 'Append the confirmation email for an order to outbox.jsonl. A side effect.',
    inputSchema: orderSchema,
  },
];

const text = (s, isError = false) => ({ content: [{ type: 'text', text: s }], isError });

export function callTool(name, args) {
  try {
    if (name === 'check_order') {
      validateOrder(args.order, config);
      return text('valid');
    }
    if (name === 'preview_notification') {
      return text(JSON.stringify(buildNotification(args.order, config), null, 2));
    }
    if (name === 'queue_notification') {
      appendFileSync('outbox.jsonl', JSON.stringify(buildNotification(args.order, config)) + '\n');
      return text('queued in outbox.jsonl');
    }
  } catch (err) {
    return text(err.message, true); // a failed tool call, not a failed server
  }
  throw Object.assign(new Error(`unknown tool: ${name}`), { code: -32602 });
}

export const resources = [
  { uri: 'orders://config', name: 'config', mimeType: 'application/json', description: 'The limits this service runs with' },
];
export function readResource(uri) {
  if (uri !== 'orders://config') throw Object.assign(new Error(`unknown resource: ${uri}`), { code: -32602 });
  const { env, currency, emailFrom, maxOrderCents } = config; // no apiToken, on purpose
  return [{ uri, mimeType: 'application/json', text: JSON.stringify({ env, currency, emailFrom, maxOrderCents }, null, 2) }];
}

export const prompts = [
  {
    name: 'review-order',
    description: 'Check an order and explain the result in one sentence',
    arguments: [{ name: 'order', description: 'The order as JSON', required: true }],
  },
];
export function getPrompt(name, args) {
  if (name !== 'review-order') throw Object.assign(new Error(`unknown prompt: ${name}`), { code: -32602 });
  return {
    messages: [{ role: 'user', content: { type: 'text', text: `Use the check_order tool on this order, then explain the result in one sentence: ${args.order}` } }],
  };
}

// One JSON-RPC message in, one reply out (or null for a notification).
export function handle(msg) {
  const { id, method, params = {} } = msg;
  if (id === undefined) return null; // notifications such as notifications/initialized
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  try {
    switch (method) {
      case 'initialize':
        return ok({
          protocolVersion: params.protocolVersion,
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: { name: 'orders', version: '1.0.0' },
          instructions: 'Tools for checking and previewing order-notifier orders.',
        });
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools });
      case 'tools/call': return ok(callTool(params.name, params.arguments ?? {}));
      case 'resources/list': return ok({ resources });
      case 'resources/read': return ok({ contents: readResource(params.uri) });
      case 'prompts/list': return ok({ prompts });
      case 'prompts/get': return ok(getPrompt(params.name, params.arguments ?? {}));
      default: return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } };
    }
  } catch (err) {
    return { jsonrpc: '2.0', id, error: { code: err.code ?? -32603, message: err.message } };
  }
}

// Debug aid: set ORDERS_MCP_LOG to a file path and every message is appended to it.
export function trace(direction, msg) {
  if (process.env.ORDERS_MCP_LOG) appendFileSync(process.env.ORDERS_MCP_LOG, `${direction} ${JSON.stringify(msg)}\n`);
}
