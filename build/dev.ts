#!/usr/bin/env bun
import { spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

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

// Start file watcher
const watcher = spawn('bun', ['--watch', 'build/build.ts'], {
  stdio: 'inherit',
});

// Handle server process exit
server.on('close', (code) => {
  if (code !== 0) {
    console.log(`Server process exited with code ${code}`);
  }
  watcher.kill();
  process.exit(code || 0);
});

// Handle watcher process exit
watcher.on('close', (code) => {
  if (code !== 0) {
    console.log(`Watcher process exited with code ${code}`);
  }
  server.kill();
  process.exit(code || 0);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.kill();
  watcher.kill();
  process.exit(0);
});

console.log('Development server running. Press Ctrl+C to stop.');
