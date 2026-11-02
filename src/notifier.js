// The only file that talks to the outside world. test/app.test.js swaps the
// sender for a fake, and test/notifier.test.js passes a fake fetch to this
// function, so the tests never open a socket.

export async function postNotification(notification, config, fetchImpl = fetch) {
  const res = await fetchImpl(config.emailEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.apiToken ? { authorization: `Bearer ${config.apiToken}` } : {}),
    },
    body: JSON.stringify(notification),
  });
  if (!res.ok) {
    throw new Error(`email endpoint returned ${res.status}`);
  }
  return { status: res.status };
}
