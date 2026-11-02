// The HTTP surface: three routes, no framework.

import { buildNotification, OrderError } from './orders.js';
import { postNotification } from './notifier.js';

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return {};
  return JSON.parse(text);
}

export function createApp(config, deps = {}) {
  const notify = deps.postNotification || postNotification;
  const seen = new Set();

  return async function handler(req, res) {
    // A request target such as `//` is not a valid URL and makes `new URL`
    // throw. In an async handler that would be an unhandled rejection, and
    // Node ends the process on one. Answer 400 instead and keep serving.
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return send(res, 400, { error: 'bad request target' });
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, env: config.env });
    }

    if (req.method === 'POST' && url.pathname === '/orders') {
      let order;
      try {
        order = await readJson(req);
      } catch {
        return send(res, 400, { error: 'body is not valid JSON' });
      }

      let notification;
      try {
        notification = buildNotification(order, config);
      } catch (err) {
        if (err instanceof OrderError) return send(res, 422, { error: err.message });
        throw err;
      }

      if (seen.has(order.id)) {
        return send(res, 200, { id: order.id, notified: false, duplicate: true });
      }

      // A send that fails is a 502, not a crash: the process stays up so the
      // next request can be served, and the order is not marked as sent.
      try {
        await notify(notification, config);
      } catch (err) {
        return send(res, 502, { id: order.id, error: `notification failed: ${err.message}` });
      }
      seen.add(order.id);
      return send(res, 201, { id: order.id, notified: true });
    }

    return send(res, 404, { error: 'not found' });
  };
}
