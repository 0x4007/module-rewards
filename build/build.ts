#!/usr/bin/env bun
import { build } from 'esbuild';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

// Ensure output directory exists
const outputDir = './public/js';
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Clean up any existing files in the output directory
try {
  const files = readdirSync(outputDir);
  for (const file of files) {
    unlinkSync(join(outputDir, file));
  }
} catch (err) {
  console.error('Error cleaning output directory:', err);
}

// Run the build process
async function runBuild() {
  try {
    console.log('Starting esbuild...');

    await build({
      entryPoints: ['./src/main.ts'],
      bundle: true,
      outfile: join(outputDir, 'main.js'),
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      minify: process.env.NODE_ENV === 'production',
      sourcemap: process.env.NODE_ENV !== 'production',
      external: ['marked'], // Mark marked as external since we load it from CDN
      logLevel: 'info',
    });

    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run build
runBuild();
