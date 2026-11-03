# Status codes in use

| Code | Where | Meaning here |
|------|-------|--------------|
| 200 | GET /health | service is up |
| 200 | POST /orders | the order id was already notified; body has duplicate: true |
| 201 | POST /orders | the notification was sent |
| 400 | any | request target is not a valid URL, or the body is not valid JSON |
| 404 | any other route | not found |
| 422 | POST /orders | the order failed validation (email, amount) |
| 502 | POST /orders | the email endpoint could not be reached or refused the notification |
