import { serve } from "bun";
import { join } from "node:path";

const server = serve({
    port: 8080,
    async fetch(req) {
        const url = new URL(req.url);
        let path = url.pathname;

        // Default to index.html
        if (path === '/') {
            path = '/index.html';
        }

        try {
            // Security: Prevent directory traversal
            const safePath = join('src', path.replace(/^\//, '')).replace(/\.\.+/g, '.');
            const file = Bun.file(safePath);
            const exists = await file.exists();

            if (!exists) {
                return new Response('Not Found', { status: 404 });
            }

            // Set correct content type for HTML files
            const headers = new Headers();
            if (safePath.endsWith('.html')) {
                headers.set('Content-Type', 'text/html; charset=utf-8');
            }

            return new Response(file, { headers });
        } catch (error) {
            console.error('Error serving file:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    },
});

console.log(`Server running at http://localhost:${server.port}`);
