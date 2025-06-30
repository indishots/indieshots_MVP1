const { spawn } = require('child_process');
const path = require('path');

// Start the server process
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true
});

server.stdout.on('data', (data) => {
  console.log(data.toString());
});

server.stderr.on('data', (data) => {
  console.error(data.toString());
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});

// Keep the process alive
process.on('SIGINT', () => {
  server.kill();
  process.exit();
});

console.log(`Server started with PID: ${server.pid}`);