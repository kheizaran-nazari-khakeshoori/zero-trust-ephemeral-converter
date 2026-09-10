import { spawn } from 'node:child_process';
import { exec } from 'node:child_process';
import { platform } from 'node:os';

const PORT = process.env.PORT || 5500;
const url = `http://127.0.0.1:${PORT}`;

const server = spawn('npx', ['serve', '.', '-l', String(PORT), '--no-port-switching'], {
  cwd: import.meta.dirname,
  stdio: 'inherit'
});

server.on('error', (err) => {
  console.error('Failed to start serve:', err.message);
  process.exit(1);
});

setTimeout(() => {
  const cmd = platform() === 'darwin' ? `open "${url}"`
    : platform() === 'win32' ? `start "" "${url}"`
    : `xdg-open "${url}" || sensible-browser "${url}"`;
  exec(cmd, (err) => {
    if (err) console.log(`Open manually: ${url}`);
    else console.log(`Opened ${url}`);
  });
}, 900);

process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
server.on('close', (code) => process.exit(code ?? 0));

//starts the server and opens the browser to the specified URL after a short delay. It also handles process termination signals to cleanly shut down the server.