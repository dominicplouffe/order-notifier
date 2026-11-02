import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
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
