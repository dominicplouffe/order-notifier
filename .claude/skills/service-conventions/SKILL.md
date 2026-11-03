---
description: Error-response and status-code conventions for the order-notifier HTTP API. Use whenever you add or change a route, an error message or a status code in src/app.js.
user-invocable: false
---

Follow these conventions whenever you touch an HTTP response in this service.

- Every error body is JSON with one key: {"error": "<short lowercase message>"}.
- Never put a stack trace or a file path in a response.
- The table of status codes in use, and what each one means here, is in status-codes.md next to this file. Read it before you choose a code.
