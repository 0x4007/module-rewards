#!/usr/bin/env bun
import { serve } from 'bun';

const PORT = 3001;

serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    // Serve index.html for root path
    if (path === '/') {
      path = '/index.html';
    }

    // Try to serve from public directory
    try {
      const file = Bun.file(`./public${path}`);
      return new Response(file);
    } catch (err) {
      return new Response('Not Found', { status: 404 });
    }
  },
});

console.log(`Server running at http://localhost:${PORT}`);
