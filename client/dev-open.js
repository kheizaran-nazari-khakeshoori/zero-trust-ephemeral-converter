import { spawn } from 'node:child_process';
import { exec } from 'node:child_process';
import { platform } from 'node:os';

const PORT = process.env.PORT || 5500;
const url = `http://127.0.0.1:${PORT}`;

const server = spawn('python3', ['-m', 'http.server', String(PORT)], {
  cwd: import.meta.dirname,
  stdio: 'inherit'
});

server.on('error', () => {
  console.error('python3 not found, try: npm run dev');
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
}, 800);

process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));

// This function checks if the file type is allowed for conversion
