import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const server = createServer(createApp(config));

server.listen(config.port, () => {
  console.log(`order-notifier (${config.env}) listening on http://localhost:${config.port}`);
});
