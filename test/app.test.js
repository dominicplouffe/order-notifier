import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { createApp } from '../src/app.js';

const config = {
  env: 'test',
  currency: 'USD',
  emailFrom: 'orders@example.test',
  emailEndpoint: 'http://127.0.0.1:1/never-called',
  apiToken: null,
  maxOrderCents: 100000,
};

// A stand-in for the email sender. Records what it was asked to send.
function fakeNotifier() {
  const sent = [];
  return {
    sent,
    postNotification: async (notification) => {
      sent.push(notification);
      return { status: 200 };
    },
  };
}

async function withServer(fn) {
  const fake = fakeNotifier();
  const server = createServer(createApp(config, { postNotification: fake.postNotification }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, fake);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const order = { id: 'ord_42', customerEmail: 'sam@example.test', amountCents: 2500 };

test('GET /health reports the environment', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, env: 'test' });
  });
});

test('POST /orders with a good order is accepted and notified once', async () => {
  await withServer(async (base, fake) => {
    const res = await fetch(`${base}/orders`, { method: 'POST', body: JSON.stringify(order) });
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { id: 'ord_42', notified: true });
    assert.equal(fake.sent.length, 1);
    assert.match(fake.sent[0].body, /25\.00 USD/);
  });
});

test('the same order posted twice is not notified twice', async () => {
  await withServer(async (base, fake) => {
    await fetch(`${base}/orders`, { method: 'POST', body: JSON.stringify(order) });
    const again = await fetch(`${base}/orders`, { method: 'POST', body: JSON.stringify(order) });
    assert.equal(again.status, 200);
    assert.deepEqual(await again.json(), { id: 'ord_42', notified: false, duplicate: true });
    assert.equal(fake.sent.length, 1);
  });
});

test('POST /orders with a broken order is a 422 and sends nothing', async () => {
  await withServer(async (base, fake) => {
    const res = await fetch(`${base}/orders`, {
      method: 'POST',
      body: JSON.stringify({ id: 'ord_43', customerEmail: 'nope', amountCents: 100 }),
    });
    assert.equal(res.status, 422);
    assert.match((await res.json()).error, /not an email address/);
    assert.equal(fake.sent.length, 0);
  });
});

test('a send that fails is a 502, and the server survives it', async () => {
  const app = createApp(config, {
    postNotification: async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:4000');
    },
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(`${base}/orders`, { method: 'POST', body: JSON.stringify(order) });
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /notification failed: connect ECONNREFUSED/);
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('a body that is not JSON is a 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/orders`, { method: 'POST', body: '{not json' });
    assert.equal(res.status, 400);
  });
});

test('an unknown route is a 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/nothing-here`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'not found' });
  });
});

// fetch() will not send every request target, so this one speaks plain http.
function rawGet(base, path) {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    const req = request({ hostname, port, path, method: 'GET' }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (text += chunk));
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error(`GET ${path}: no answer within 2s`)));
    req.end();
  });
}

test('a request target that is not a valid URL is a 400, and the server survives it', async () => {
  await withServer(async (base) => {
    // `//` is the target the Walker used to kill the process. The others fail
    // `new URL` in the same way.
    for (const path of ['//', '///', '//:', '//?x']) {
      const res = await rawGet(base, path);
      assert.equal(res.status, 400, `GET ${path}`);
      assert.deepEqual(JSON.parse(res.text), { error: 'bad request target' });
    }
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
  });
});

test('an order whose send failed is not marked sent: the retry reaches the sender again', async () => {
  let calls = 0;
  const app = createApp(config, {
    postNotification: async () => {
      calls += 1;
      if (calls === 1) throw new Error('connect ECONNREFUSED 127.0.0.1:4000');
      return { status: 200 };
    },
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = () => fetch(`${base}/orders`, { method: 'POST', body: JSON.stringify(order) });
  try {
    const first = await post();
    assert.equal(first.status, 502);
    assert.equal(calls, 1);

    const retry = await post();
    assert.equal(retry.status, 201);
    assert.deepEqual(await retry.json(), { id: 'ord_42', notified: true });
    assert.equal(calls, 2);

    // Only now is it marked sent: a third post is a duplicate and sends nothing.
    const third = await post();
    assert.equal(third.status, 200);
    assert.deepEqual(await third.json(), { id: 'ord_42', notified: false, duplicate: true });
    assert.equal(calls, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('an order of exactly maxOrderCents is accepted, and one cent more is a 422', async () => {
  await withServer(async (base, fake) => {
    const atLimit = await fetch(`${base}/orders`, {
      method: 'POST',
      body: JSON.stringify({ ...order, id: 'ord_limit', amountCents: config.maxOrderCents }),
    });
    assert.equal(atLimit.status, 201);
    assert.equal(fake.sent.length, 1);

    const over = await fetch(`${base}/orders`, {
      method: 'POST',
      body: JSON.stringify({ ...order, id: 'ord_over', amountCents: config.maxOrderCents + 1 }),
    });
    assert.equal(over.status, 422);
    assert.match((await over.json()).error, /over the configured limit of 100000/);
    assert.equal(fake.sent.length, 1);
  });
});
