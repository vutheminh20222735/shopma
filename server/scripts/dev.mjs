import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const children = [
  spawn(process.execPath, ['--watch', '--import', 'tsx', 'server/index.ts'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'inherit',
  }),
  spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['--prefix', 'client', 'run', 'start', '--', '--configuration', 'development'],
    { cwd: root, env: process.env, stdio: 'inherit', shell: process.platform === 'win32' },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
