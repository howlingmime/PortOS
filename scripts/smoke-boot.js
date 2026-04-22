#!/usr/bin/env node
// Server boot smoke test — imports server/index.js in a child process and
// verifies it stays alive for SMOKE_WINDOW_MS without crashing. Catches the
// class of bug where top-level initialization code throws (e.g. chaining
// .catch on a sync function that returns undefined), which is invisible to
// unit tests that import service modules in isolation.

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SMOKE_WINDOW_MS = Number(process.env.SMOKE_WINDOW_MS ?? 4000);
const SERVER_ENTRY = join(__dirname, '..', 'server', 'index.js');

// Use a dedicated port range so we don't collide with a running PortOS.
const env = {
  ...process.env,
  PORT: process.env.SMOKE_PORT ?? '55559',
  PORTOS_HTTP_PORT: process.env.SMOKE_HTTP_PORT ?? '55557',
  NODE_ENV: 'test',
  SKIP_PM2_BRIDGE: '1',
  // Let the child bail loudly on unhandled rejections
  NODE_OPTIONS: '--unhandled-rejections=strict'
};

const child = spawn(process.execPath, [SERVER_ENTRY], {
  env,
  stdio: ['ignore', 'pipe', 'pipe']
});

let firstErr = '';
let crashed = false;
let exitCode = null;

child.stdout.on('data', (d) => process.stdout.write(`[smoke] ${d}`));
child.stderr.on('data', (d) => {
  const s = d.toString();
  if (!firstErr) firstErr = s;
  process.stderr.write(`[smoke err] ${s}`);
});
child.on('exit', (code) => { crashed = true; exitCode = code; });

setTimeout(() => {
  if (crashed) {
    console.error(`❌ Server crashed during ${SMOKE_WINDOW_MS}ms boot window (exit ${exitCode}).`);
    if (firstErr) console.error('First error:\n' + firstErr);
    process.exit(1);
  }
  console.log(`✅ Server survived ${SMOKE_WINDOW_MS}ms boot window.`);
  child.kill('SIGTERM');
  // Give it a moment to shut down cleanly; then exit
  setTimeout(() => process.exit(0), 500);
}, SMOKE_WINDOW_MS);
