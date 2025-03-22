#!/usr/bin/env bun
import { spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync, watch } from 'fs';
import { WebSocketServer } from 'ws';

// Create WebSocket server for live reload
const wss = new WebSocketServer({ port: 8080 });

// Function to notify clients to reload
function notifyReload() {
  wss.clients.forEach(client => {
    client.send('reload');
  });
}

// Ensure output directory exists
const outputDir = './public/js';
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

console.log('Starting development server...');

// Run initial build
const initialBuild = spawnSync('bun', ['run', 'build/build.ts'], {
  stdio: 'inherit',
});

if (initialBuild.status !== 0) {
  console.error('Initial build failed');
  process.exit(1);
}

// Start the server
const server = spawn('bun', ['run', 'src/server.ts'], {
  stdio: 'inherit',
});

// Watch TypeScript files for changes
const tsWatcher = watch('./src', { recursive: true }, (event, filename) => {
  if (filename && filename.endsWith('.ts')) {
    console.log('TypeScript file changed:', filename);
    // Run build
    const build = spawnSync('bun', ['run', 'build/build.ts'], {
      stdio: 'inherit',
    });
    if (build.status === 0) {
      console.log('Build successful, triggering reload...');
      notifyReload();
    }
  }
});

// Also watch build.ts itself
const buildWatcher = spawn('bun', ['--watch', 'build/build.ts'], {
  stdio: 'inherit',
});

// Handle server process exit
server.on('close', (code) => {
  if (code !== 0) {
    console.log(`Server process exited with code ${code}`);
  }
  buildWatcher.kill();
  tsWatcher.close();
  wss.close();
  process.exit(code || 0);
});

// Handle build watcher process exit
buildWatcher.on('close', (code) => {
  if (code !== 0) {
    console.log(`Build watcher process exited with code ${code}`);
  }
  server.kill();
  tsWatcher.close();
  wss.close();
  process.exit(code || 0);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.kill();
  buildWatcher.kill();
  tsWatcher.close();
  wss.close();
  process.exit(0);
});

console.log('Development server running. Press Ctrl+C to stop.');
