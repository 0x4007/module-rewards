#!/usr/bin/env bun
import { serve, Server } from "bun";

const PORT = 3001;

console.log("Server initialization starting...");

try {
  console.log("Setting up server routes...");
  const server = serve({
    port: PORT,
    hostname: "localhost",
    async fetch(req) {
      try {
        const url = new URL(req.url);
        let path = url.pathname;

        // Serve index.html for root path
        if (path === "/") {
          path = "/index.html";
          console.log("Serving index.html for root path");
        }

        // Try to serve from public directory
        const filePath = `./public${path}`;
        const file = Bun.file(filePath);

        // Check if file exists
        const exists = await file.exists();
        if (!exists) {
          console.error(`File not found: ${filePath}`);
          return new Response("Not Found", { status: 404 });
        }

        console.log(`Serving file: ${filePath}`);
        return new Response(file);
      } catch (err) {
        console.error("Error serving request:", err);
        return new Response("Internal Server Error", { status: 500 });
      }
    },
    error(error: Error) {
      console.error("Server error:", error);
      return new Response("Internal Server Error", { status: 500 });
    },
  });

  // Log when server is ready
  if (server) {
    const address = `http://localhost:${PORT}`;
    console.log(`✨ Server is ready and listening at ${address}`);
  } else {
    throw new Error("Failed to create server instance");
  }
} catch (err) {
  console.error("Failed to start server:", err);
  process.exit(1);
}
