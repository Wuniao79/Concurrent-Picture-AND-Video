import { spawn } from 'child_process';
import { platform } from 'os';

const PORT = 3000;

const killPortWindows = (port) =>
  new Promise((resolve) => {
    const finder = spawn('powershell', [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
    ]);

    let output = '';
    finder.stdout.on('data', (d) => (output += d.toString()));
    finder.on('close', () => {
      const pid = parseInt(output.trim(), 10);
      if (!pid) return resolve();
      const killer = spawn('powershell', ['-NoProfile', '-Command', `Stop-Process -Id ${pid} -Force`]);
      killer.on('close', () => resolve());
    });
    finder.on('error', () => resolve());
  });

const killPortUnix = (port) =>
  new Promise((resolve) => {
    const lsof = spawn('bash', ['-lc', `lsof -ti tcp:${port}`]);
    let output = '';
    lsof.stdout.on('data', (d) => (output += d.toString()));
    lsof.on('close', () => {
      const pids = output
        .split('\n')
        .map((v) => v.trim())
        .filter(Boolean);
      if (pids.length === 0) return resolve();
      const killer = spawn('bash', ['-lc', `kill -9 ${pids.join(' ')}`]);
      killer.on('close', () => resolve());
    });
    lsof.on('error', () => resolve());
  });

async function ensurePortFree(port) {
  if (platform() === 'win32') {
    await killPortWindows(port);
  } else {
    await killPortUnix(port);
  }
}

async function start() {
  await ensurePortFree(PORT);

  const child = spawn('npm', ['run', 'dev:serve'], {
    stdio: 'inherit',
    shell: true,
  });

  const cleanup = () => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  child.on('exit', (code) => process.exit(code ?? 0));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
