import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrder, formatAmount, buildNotification, OrderError } from '../src/orders.js';

const config = { currency: 'USD', emailFrom: 'orders@example.test', maxOrderCents: 50000 };

const good = (over = {}) => ({ id: 'ord_1', customerEmail: 'sam@example.test', amountCents: 1299, ...over });

test('a well formed order validates', () => {
  assert.equal(validateOrder(good(), config), true);
});

test('missing id is rejected', () => {
  assert.throws(() => validateOrder(good({ id: '' }), config), OrderError);
});

test('a customer email that is not an email is rejected', () => {
  assert.throws(() => validateOrder(good({ customerEmail: 'sam' }), config), /not an email address/);
});

test('a zero or negative amount is rejected', () => {
  assert.throws(() => validateOrder(good({ amountCents: 0 }), config), /positive integer/);
});

test('an amount over the configured limit is rejected and named in the message', () => {
  assert.throws(() => validateOrder(good({ amountCents: 50001 }), config), /over the configured limit of 50000/);
});

test('an amount of exactly the configured limit is accepted', () => {
  assert.equal(validateOrder(good({ amountCents: 50000 }), config), true);
});

test('amounts format with two decimals and the currency', () => {
  assert.equal(formatAmount(1299, 'USD'), '12.99 USD');
  assert.equal(formatAmount(5, 'EUR'), '0.05 EUR');
});

test('the notification names the order and the amount', () => {
  const n = buildNotification(good(), config);
  assert.equal(n.to, 'sam@example.test');
  assert.equal(n.from, 'orders@example.test');
  assert.equal(n.subject, 'Order ord_1 confirmed');
  assert.match(n.body, /12\.99 USD/);
});
