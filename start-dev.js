const { spawn } = require('child_process');
const path = require('path');

const workdir = path.join('C:', 'Users', 'K4O', 'Desktop', 'Programowanie, AI i Skrypty', 'WorkFinder');

const child = spawn('npm', ['run', 'dev'], {
  cwd: workdir,
  shell: true,
  stdio: 'inherit',
  windowsHide: true
});

child.on('error', (err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code);
});
