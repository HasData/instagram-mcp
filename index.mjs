#!/usr/bin/env node
// Thin launcher: connects an MCP client to HasData's hosted Instagram MCP server
// (streamable HTTP) through the mcp-remote stdio bridge. The server runs remotely;
// this package only proxies, so nothing here scrapes anything.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const URL = 'https://mcp.hasdata.com/api/mcp?apis=instagram';
const key = process.env.HASDATA_API_KEY;
if (!key) {
  process.stderr.write('HASDATA_API_KEY is not set. Create a free key at https://app.hasdata.com and set HASDATA_API_KEY.\n');
  process.exit(1);
}
// Resolve mcp-remote's CLI from its own package.json bin, so a future layout change
// or an exports map does not break a hardcoded deep path.
const require = createRequire(import.meta.url);
const pkg = require('mcp-remote/package.json');
const proxy = join(dirname(require.resolve('mcp-remote/package.json')), pkg.bin['mcp-remote']);
const child = spawn(process.execPath, [proxy, URL, '--header', `x-api-key:${key}`], { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
