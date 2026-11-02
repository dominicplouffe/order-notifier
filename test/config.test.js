import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('the test config file is what tests get by default', () => {
  const config = loadConfig({ NOTIFIER_ENV: 'test' });
  assert.equal(config.env, 'test');
  assert.equal(config.currency, 'USD');
  assert.equal(config.port, 0);
});

test('environment variables win over the file', () => {
  const config = loadConfig({ NOTIFIER_ENV: 'test', PORT: '8080', NOTIFIER_EMAIL_FROM: 'ops@example.test' });
  assert.equal(config.port, 8080);
  assert.equal(config.emailFrom, 'ops@example.test');
});

test('an environment with no config file fails loudly', () => {
  assert.throws(() => loadConfig({ NOTIFIER_ENV: 'staging' }), /cannot read config file/);
});
