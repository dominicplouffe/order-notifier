// Loads settings from config/<NOTIFIER_ENV>.json and lets a few environment
// variables win over it. Nothing in here has a default that is a real secret.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// `pick` is one env value: undefined if the key is absent. A key that is
// present but empty counts as absent too, which is what a shell does to you.
function pick(env, key) {
  const value = env[key];
  return value === undefined || value === '' ? undefined : value;
}

export function loadConfig(env = process.env) {
  const name = pick(env, 'NOTIFIER_ENV') || 'development';
  const file = join(root, 'config', `${name}.json`);
  let fromFile;
  try {
    fromFile = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read config file ${file}: ${err.message}`);
  }

  const port = pick(env, 'PORT');

  return {
    env: name,
    port: Number(port ?? fromFile.port ?? 3000),
    currency: fromFile.currency || 'USD',
    emailFrom: pick(env, 'NOTIFIER_EMAIL_FROM') ?? fromFile.emailFrom,
    emailEndpoint: pick(env, 'NOTIFIER_EMAIL_ENDPOINT') ?? fromFile.emailEndpoint,
    apiToken: pick(env, 'NOTIFIER_API_TOKEN') ?? fromFile.apiToken,
    maxOrderCents: fromFile.maxOrderCents ?? 100000,
  };
}
