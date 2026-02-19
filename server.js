const { spawnSync, spawn } = require('child_process');
const path = require('path');

function runSync(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.error) {
    console.error(`Failed to run ${cmd} ${args.join(' ')}`);
    console.error(res.error);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`${cmd} ${args.join(' ')} exited with code ${res.status}`);
    process.exit(res.status);
  }
}

// Preflight: check whether the configured port is free
const desiredPort = parseInt(process.env.PORT || '3000', 10);
function findProcessOnPort(port) {
  const { spawnSync } = require('child_process');
  // Try lsof first (common on macOS/Linux)
  try {
    const lsof = spawnSync('lsof', ['-i', `:${port}`, '-sTCP:LISTEN', '-Pn'], { encoding: 'utf8' });
    if (lsof.status === 0 && lsof.stdout.trim()) return lsof.stdout.trim();
  } catch (e) {
    /* ignore */
  }

  // Fallback to ss (Linux)
  try {
    const ss = spawnSync('ss', ['-ltnp'], { encoding: 'utf8' });
    if (ss.status === 0 && ss.stdout) {
      const lines = ss.stdout.split(/\r?\n/).filter(Boolean);
      const match = lines.find(l => l.includes(`:${port}`));
      if (match) return match.trim();
    }
  } catch (e) {
    /* ignore */
  }

  return null;
}

const existing = findProcessOnPort(desiredPort);
if (existing) {
  console.error(`ERROR: port ${desiredPort} already in use.\n` +
    `Process information:\n${existing}\n\n` +
    `Options:\n` +
    `  • kill the process using the port (e.g. \`lsof -t -i :${desiredPort} | xargs kill\`)\n` +
    `  • set a different port before starting: \`PORT=3000 npm start\`\n` +
    `  • or run with SKIP_BUILD=1 to skip rebuilds if you intentionally run multiple instances.\n`);
  process.exit(1);
}

// Build frontend + backend unless explicitly skipped
const skipBuild = process.env.SKIP_BUILD === '1' || process.argv.includes('--no-build');
if (!skipBuild) {
  console.log('Building frontend (web)...');
  runSync('npm', ['--workspace=@logscope/web', 'run', 'build']);

  console.log('Building backend (server)...');
  runSync('npm', ['--workspace=@logscope/server', 'run', 'build']);
} else {
  console.log('Skipping build step (SKIP_BUILD or --no-build detected)');
}

// Resolve server entry and spawn it so stdout/stderr are forwarded
const serverEntry = path.join(__dirname, 'server', 'dist', 'index.js');
const child = spawn(process.execPath, [serverEntry], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' }
});

const forwardSignal = (sig) => {
  try { child.kill(sig); } catch (_) {}
};
process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('Failed to start server child process:', err);
  process.exit(1);
});
