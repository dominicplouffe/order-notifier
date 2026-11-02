# order-notifier

A toy order-notification service. It takes an order over HTTP, checks it, builds a confirmation email, and posts that email to an endpoint you configure. It is the companion repository for the Claude Code guide at <https://dplouffe.ca/guides/>: small enough to read in one sitting, real enough that hooks, subagents, slash commands and CI have something to act on.

No dependencies. Node 20 or newer and nothing else: no `npm install` step, because there is nothing to install.

## Run it

```sh
git clone https://github.com/dominicplouffe/order-notifier.git
cd order-notifier
npm test
npm start
```

`npm start` reads `config/development.json` and listens on port 3000.

```sh
curl -s localhost:3000/health
curl -s -X POST localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{"id":"ord_1","customerEmail":"sam@example.test","amountCents":1299}'
```

The first call answers `{"ok":true,"env":"development"}`. The second answers `{"id":"ord_1","notified":true}` and POSTs the notification to `emailEndpoint`. The default endpoint is `http://127.0.0.1:4000/send`, which almost certainly has nothing listening on it, so in development the second call answers `502` with `{"id":"ord_1","error":"notification failed: fetch failed"}` and sends nothing. The server keeps running. Point `NOTIFIER_EMAIL_ENDPOINT` at something real to see a `201`.

## How it is laid out

```
src/config.js    reads config/<NOTIFIER_ENV>.json, lets environment variables win
src/orders.js    validates an order and builds the notification. pure functions
src/notifier.js  the one place that makes a network call
src/app.js       the three routes: GET /health, POST /orders, 404 otherwise
src/server.js    wires config and app to a real HTTP server
config/          development.json and test.json
test/            node:test files; the email sender is faked, so no sockets in tests
```

## Routes

| Method | Path | Answers |
|--------|------|---------|
| GET | `/health` | `200` with `{"ok":true,"env":"<env>"}` |
| POST | `/orders` | `201` with `{"id","notified":true}`; `200` with `"duplicate":true` if the same id is posted again; `400` for a body that is not JSON; `422` for an order that fails validation; `502` if the notification cannot be sent (nothing is marked sent, so a retry tries again) |
| any | anything else | `404` with `{"error":"not found"}` |

## Configuration

`config/<NOTIFIER_ENV>.json`, where `NOTIFIER_ENV` defaults to `development`. The tests set it to `test`. These environment variables override the file:

- `PORT`
- `NOTIFIER_EMAIL_ENDPOINT`
- `NOTIFIER_EMAIL_FROM`
- `NOTIFIER_API_TOKEN`

Secrets belong in `.env` (git-ignored) or your shell, never in `config/`. `.env.example` shows the names with fake values. To use a `.env` file, export it yourself; this repository has no dotenv loader and does not want one.

## Tests

```sh
npm test
```

`node --test` runs everything named `*.test.js` under `test/`. (On Node 22, `node --test test/` treats the argument as a module path and fails with "Cannot find module". Leave the argument off.) The suite covers order validation, amount formatting, the notification, every route including the duplicate, 400, 404, 422 and 502 paths, and config precedence. It never opens a socket to the email endpoint: the sender is replaced with a fake.

## CI

`.github/workflows/ci.yml` runs `npm test` on Node 20 and 22 for every push and pull request.

## Licence

MIT. See `LICENSE`.
