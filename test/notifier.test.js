import test from 'node:test';
import assert from 'node:assert/strict';
import { postNotification } from '../src/notifier.js';

const notification = {
  to: 'sam@example.test',
  from: 'orders@example.test',
  subject: 'Order ord_1 confirmed',
  body: 'Thanks.',
};

// A stand-in for fetch. Records the call and answers with the status you give it.
function fakeFetch(status = 200) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status };
  };
  return { calls, impl };
}

test('the notification is POSTed as JSON to the configured endpoint', async () => {
  const fake = fakeFetch(200);
  const config = { emailEndpoint: 'http://mail.example.test/send', apiToken: null };
  const result = await postNotification(notification, config, fake.impl);
  assert.deepEqual(result, { status: 200 });
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].url, 'http://mail.example.test/send');
  assert.equal(fake.calls[0].init.method, 'POST');
  assert.equal(fake.calls[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(fake.calls[0].init.body), notification);
});

test('with an apiToken the request carries it as a Bearer authorization header', async () => {
  const fake = fakeFetch(200);
  const config = { emailEndpoint: 'http://mail.example.test/send', apiToken: 'tok_fake_123' };
  await postNotification(notification, config, fake.impl);
  assert.equal(fake.calls[0].init.headers.authorization, 'Bearer tok_fake_123');
});

test('without an apiToken there is no authorization header at all', async () => {
  const fake = fakeFetch(200);
  const config = { emailEndpoint: 'http://mail.example.test/send', apiToken: null };
  await postNotification(notification, config, fake.impl);
  assert.equal('authorization' in fake.calls[0].init.headers, false);
});

test('an endpoint that answers with an error status makes the send throw', async () => {
  const fake = fakeFetch(503);
  const config = { emailEndpoint: 'http://mail.example.test/send', apiToken: null };
  await assert.rejects(
    () => postNotification(notification, config, fake.impl),
    /email endpoint returned 503/
  );
});
