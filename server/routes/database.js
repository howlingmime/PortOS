import { Router } from 'express';
import { execFile } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { asyncHandler } from '../lib/errorHandler.js';
import { checkHealth } from '../lib/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..');
const dbScript = join(rootDir, 'scripts', 'db.sh');

const router = Router();

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

/**
 * Run db.sh with given args and return { stdout, stderr, exitCode }.
 * Timeout after 120s to cover slow Docker pulls or native setup.
 */
function runDbScript(args) {
  return new Promise((resolve) => {
    execFile('bash', [dbScript, ...args], {
      cwd: rootDir,
      timeout: 120_000,
      env: process.env
    }, (err, stdout, stderr) => {
      resolve({
        stdout: stripAnsi(stdout || ''),
        stderr: stripAnsi(stderr || ''),
        exitCode: err?.code ?? 0
      });
    });
  });
}

// GET /api/database/status — current mode, connectivity, row counts
router.get('/status', asyncHandler(async (req, res) => {
  const [scriptResult, health] = await Promise.all([
    runDbScript(['status']),
    checkHealth()
  ]);

  // Parse mode from script output
  const modeMatch = scriptResult.stdout.match(/Current mode:\s*(\w+)/);
  const mode = modeMatch?.[1] || 'unknown';

  // Parse Docker status
  const dockerRunning = /Container portos-db is running/.test(scriptResult.stdout);
  const dockerInstalled = !/Docker not installed/.test(scriptResult.stdout);
  const dockerDaemon = !/Docker daemon is not running/.test(scriptResult.stdout);

  // Parse native status
  const nativeInstalled = !/Native PostgreSQL not installed/.test(scriptResult.stdout);
  const nativeRunning = /Native PostgreSQL is running/.test(scriptResult.stdout);
  const nativeConfigured = nativeInstalled && !/not configured for PortOS/.test(scriptResult.stdout);

  // Parse row count
  const rowMatch = scriptResult.stdout.match(/Memories table has (\d+|N\/A) rows/);
  const memoryCount = rowMatch?.[1] === 'N/A' ? null : parseInt(rowMatch?.[1] || '0', 10);

  const connected = /Database is accepting connections/.test(scriptResult.stdout);

  res.json({
    mode,
    connected,
    memoryCount,
    health,
    docker: { installed: dockerInstalled, daemonRunning: dockerDaemon, containerRunning: dockerRunning },
    native: { installed: nativeInstalled, configured: nativeConfigured, running: nativeRunning }
  });
}));

// POST /api/database/switch — switch mode and optionally migrate
router.post('/switch', asyncHandler(async (req, res) => {
  const { target, migrate } = req.body;
  if (!target || !['docker', 'native'].includes(target)) {
    return res.status(400).json({ error: 'target must be "docker" or "native"' });
  }

  const io = req.app.get('io');

  const emit = (event, data) => io?.emit('database:progress', { event, ...data });

  if (migrate) {
    emit('start', { message: `Migrating data to ${target}...` });
    const result = await runDbScript(['migrate']);
    if (result.exitCode !== 0) {
      emit('error', { message: `Migration failed` });
      return res.status(500).json({
        error: 'Migration failed',
        details: result.stderr || result.stdout
      });
    }
    emit('complete', { message: `Migration to ${target} complete` });
    return res.json({ success: true, output: result.stdout });
  }

  // Just switch mode without migrating
  emit('start', { message: `Switching to ${target}...` });
  const switchResult = await runDbScript([target === 'docker' ? 'use-docker' : 'use-native']);
  if (switchResult.exitCode !== 0) {
    emit('error', { message: `Switch failed` });
    return res.status(500).json({
      error: 'Switch failed',
      details: switchResult.stderr || switchResult.stdout
    });
  }

  // Start the new mode
  const startResult = await runDbScript(['start']);
  if (startResult.exitCode !== 0) {
    emit('error', { message: `Failed to start ${target} database` });
    return res.status(500).json({
      error: `Failed to start ${target} database`,
      details: startResult.stderr || startResult.stdout
    });
  }

  emit('complete', { message: `Switched to ${target}` });
  res.json({ success: true, output: switchResult.stdout + '\n' + startResult.stdout });
}));

// POST /api/database/setup-native — install and configure native PostgreSQL
router.post('/setup-native', asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  io?.emit('database:progress', { event: 'start', message: 'Setting up native PostgreSQL...' });

  const result = await runDbScript(['setup-native']);
  if (result.exitCode !== 0) {
    io?.emit('database:progress', { event: 'error', message: 'Native setup failed' });
    return res.status(500).json({
      error: 'Native PostgreSQL setup failed',
      details: result.stderr || result.stdout
    });
  }

  io?.emit('database:progress', { event: 'complete', message: 'Native PostgreSQL ready' });
  res.json({ success: true, output: result.stdout });
}));

// POST /api/database/export — export database to SQL dump
router.post('/export', asyncHandler(async (req, res) => {
  const result = await runDbScript(['export']);
  if (result.exitCode !== 0) {
    return res.status(500).json({
      error: 'Export failed',
      details: result.stderr || result.stdout
    });
  }
  // Last non-empty line of stdout is the dump file path
  const lines = result.stdout.trim().split('\n');
  const dumpFile = lines[lines.length - 1]?.trim();
  res.json({ success: true, dumpFile, output: result.stdout });
}));

// POST /api/database/fix — fix stale pid files
router.post('/fix', asyncHandler(async (req, res) => {
  const result = await runDbScript(['fix']);
  res.json({
    success: result.exitCode === 0,
    output: result.stdout,
    error: result.exitCode !== 0 ? (result.stderr || result.stdout) : undefined
  });
}));

export default router;
