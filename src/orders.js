// Order validation and the notification message built from an order.
// Pure functions only: no network, no clock, no files. That is deliberate —
// it is what makes this small enough to hold in your head.

export class OrderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OrderError';
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOrder(order, config) {
  if (!order || typeof order !== 'object') {
    throw new OrderError('order must be an object');
  }
  if (typeof order.id !== 'string' || order.id.trim() === '') {
    throw new OrderError('order.id is required');
  }
  if (typeof order.customerEmail !== 'string' || !EMAIL.test(order.customerEmail)) {
    throw new OrderError(`order.customerEmail is not an email address: ${order.customerEmail}`);
  }
  if (!Number.isInteger(order.amountCents) || order.amountCents <= 0) {
    throw new OrderError('order.amountCents must be a positive integer');
  }
  if (order.amountCents > config.maxOrderCents) {
    throw new OrderError(
      `order.amountCents ${order.amountCents} is over the configured limit of ${config.maxOrderCents}`
    );
  }
  return true;
}

export function formatAmount(cents, currency) {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export function buildNotification(order, config) {
  validateOrder(order, config);
  return {
    to: order.customerEmail,
    from: config.emailFrom,
    subject: `Order ${order.id} confirmed`,
    body: `Thanks. We have your order ${order.id} for ${formatAmount(order.amountCents, config.currency)}.`,
  };
}
