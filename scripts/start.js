import { EmotosMCPProxy } from '../src/proxy.js';

const proxy = new EmotosMCPProxy();

proxy.start().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
