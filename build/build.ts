#!/usr/bin/env bun

console.log('🔨 Build process starting...');

const BUILD_TIMEOUT = 10000; // 10 seconds

// Set environment if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Log build mode
console.log(`Building for ${process.env.NODE_ENV} environment`);

// Handle unexpected errors
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection in build:', err);
  process.exit(1);
});

// Run build with timeout
const buildPromise = new Promise(async (resolve, reject) => {
  try {
    console.log('Starting Bun build...');
    const startTime = Date.now();

    await Bun.build({
      entrypoints: ['./src/main.ts', './src/analyzer.ts'],
      outdir: './public/js',
      target: 'browser',
      format: 'esm',
      minify: process.env.NODE_ENV === 'production',
      sourcemap: process.env.NODE_ENV === 'production' ? 'external' : 'inline',
      external: ['marked'],
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
        'global': 'window',
        'process': '{ env: { NODE_ENV: ' + JSON.stringify(process.env.NODE_ENV || 'production') + ' } }'
      },
    }).then(result => {
      if (!result.success) {
        throw new Error(`Build failed: ${result.logs}`);
      }
      const buildTime = Date.now() - startTime;
      console.log(`✓ Build completed in ${buildTime}ms`);
      resolve(result);
    });
  } catch (error) {
    reject(error);
  }
});

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    reject(new Error('Build timed out after 10 seconds'));
  }, BUILD_TIMEOUT);
});

Promise.race([buildPromise, timeoutPromise])
  .catch(error => {
    console.error('Build process error:', error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
