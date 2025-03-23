#!/usr/bin/env bun
import { spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync, watch } from 'fs';
import { WebSocketServer } from 'ws';

// Create WebSocket server for live reload
let wss: WebSocketServer;
try {
  wss = new WebSocketServer({ port: 8081 });
  console.log('✓ WebSocket server initialized');
} catch (err) {
  console.error('Failed to start WebSocket server:', err);
  process.exit(1);
}

// Function to notify clients to reload
function notifyReload() {
  wss.clients.forEach(client => {
    try {
      client.send('reload');
    } catch (err) {
      console.error('Failed to send reload notification:', err);
    }
  });
}

// Ensure output directory exists
const outputDir = './public/js';
if (!existsSync(outputDir)) {
  try {
    mkdirSync(outputDir, { recursive: true });
    console.log('✓ Output directory created');
  } catch (err) {
    console.error('Failed to create output directory:', err);
    process.exit(1);
  }
}

let isInitialBuildComplete = false;
let isServerRunning = false;

console.log('\n🚀 Starting development environment...\n');

// Run initial build
console.log('Building project...');
const initialBuild = spawnSync('bun', ['run', 'build/build.ts'], {
  stdio: 'inherit',
  timeout: 10000 // 10 second timeout
});

if (initialBuild.error) {
  console.error('Build process timed out or failed:', initialBuild.error);
  process.exit(1);
}

if (initialBuild.status !== 0) {
  console.error('Initial build failed with status:', initialBuild.status);
  process.exit(1);
}

isInitialBuildComplete = true;
console.log('✓ Initial build complete');

// Start the server
console.log('\nStarting local server...');
const server = spawn('bun', ['run', 'src/server.ts'], {
  stdio: 'inherit'
});

// Watch for server startup
let startupTimeout = setTimeout(() => {
  if (!isServerRunning) {
    console.error('\n❌ Server failed to start within 5 seconds');
    cleanup(1);
  }
}, 5000);

server.on('spawn', () => {
  isServerRunning = true;
  clearTimeout(startupTimeout);
  console.log('✓ Development server process started');
});

// Watch TypeScript files for changes
console.log('\nInitializing file watchers...');
const tsWatcher = watch('./src', { recursive: true }, (event, filename) => {
  if (filename && filename.endsWith('.ts')) {
    console.log('\nFile changed:', filename);
    try {
      // Run build
      console.log('Running build...');
      const build = spawnSync('bun', ['run', 'build/build.ts'], {
        stdio: 'inherit',
        timeout: 5000
      });

      if (build.error) {
        console.error('Build timed out:', build.error);
        return;
      }

      if (build.status === 0) {
        console.log('✓ Build successful');
        notifyReload();
      } else {
        console.error('❌ Build failed');
      }
    } catch (err) {
      console.error('Build process error:', err);
    }
  }
});

console.log('✓ File watchers initialized');

// Clean up function
function cleanup(code = 0) {
  console.log('\n🛑 Shutting down development environment...');
  try {
    server.kill();
    console.log('✓ Server stopped');
  } catch (err) {
    console.error('Error stopping server:', err);
  }

  try {
    tsWatcher.close();
    console.log('✓ File watchers closed');
  } catch (err) {
    console.error('Error closing watchers:', err);
  }

  try {
    wss.close();
    console.log('✓ WebSocket server closed');
  } catch (err) {
    console.error('Error closing WebSocket server:', err);
  }

  if (code === 0) {
    console.log('\n👋 Development environment shutdown complete');
  } else {
    console.error('\n❌ Development environment shutdown with errors');
  }

  process.exit(code);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nReceived shutdown signal');
  cleanup();
});

process.on('SIGTERM', () => {
  console.log('\nReceived termination signal');
  cleanup();
});

process.on('unhandledRejection', (err) => {
  console.error('\nUnhandled promise rejection:', err);
  cleanup(1);
});

process.on('uncaughtException', (err) => {
  console.error('\nUncaught exception:', err);
  cleanup(1);
});

// Check initial setup completed
if (isInitialBuildComplete && isServerRunning) {
  console.log('\n✨ Development environment ready!\n');
  console.log('- Local server: http://localhost:3002');
  console.log('- WebSocket server: ws://localhost:8081');
  console.log('\nPress Ctrl+C to stop');
}
