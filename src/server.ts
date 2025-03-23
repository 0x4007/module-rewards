#!/usr/bin/env bun
import { serve } from "bun";
import { ModuleChain } from "./core/module-chain";
import { ContentFilter } from "./modules/content-filter";
import { ScoringPipeline } from "./modules/scoring-pipeline";
import { ReadabilityScorer, TechnicalScorer } from "./scorers";

const PORT = 3002;

console.log("Server initialization starting...");

// Initialize scoring pipeline
const scoringChain = new ModuleChain("scoring")
  .addModule(new ContentFilter())
  .addModule(
    new ScoringPipeline({
      scorers: [
        {
          scorer: new ReadabilityScorer({ targetScore: 70 }),
          weight: 0.6
        },
        {
          scorer: new TechnicalScorer({
            weights: {
              codeBlockQuality: 0.5,
              technicalTerms: 0.3,
              explanationQuality: 0.2
            }
          }),
          weight: 0.4
        }
      ],
      debug: true,
    })
  );

try {
  console.log("Setting up server routes...");
  const server = serve({
    port: PORT,
    hostname: "localhost",
    async fetch(req) {
      try {
        const url = new URL(req.url);
        const path = url.pathname;

        // Handle API routes
        if (path.startsWith("/api/")) {
          // Environment endpoint - safely expose necessary environment variables
          if (path === "/api/environment") {
            return new Response(JSON.stringify({
              githubToken: process.env.GITHUB_TOKEN || null
            }), {
              headers: { "Content-Type": "application/json" }
            });
          }

          // Score content endpoint
          if (path === "/api/score" && req.method === "POST") {
            try {
              const body = await req.json();
              const content = body.content;

              if (!content || typeof content !== "string") {
                return new Response(
                  JSON.stringify({ error: "Content is required and must be a string" }),
                  { status: 400, headers: { "Content-Type": "application/json" } }
                );
              }

              // Create cloud event for scoring
              const event = {
                specversion: "1.0",
                type: "com.github.comment",
                source: "/api/score",
                id: crypto.randomUUID(),
                time: new Date().toISOString(),
                data: { content },
              };

              // Process through scoring pipeline
              const result = await scoringChain.execute(event);

              return new Response(JSON.stringify(result), {
                headers: { "Content-Type": "application/json" },
              });
            } catch (err) {
              console.error("Error processing score request:", err);
              return new Response(
                JSON.stringify({ error: "Invalid request body" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
          }

          // Unknown API endpoint
          return new Response(
            JSON.stringify({ error: "Endpoint not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }

        // Serve static files
        let filePath = path === "/" ? "/index.html" : path;
        filePath = `./public${filePath}`;
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
    console.log("Available endpoints:");
    console.log("  GET  /api/environment - Get environment configuration");
    console.log("  POST /api/score - Score content using the scoring pipeline");
    console.log("     Request body: { \"content\": \"text to score\" }");
  } else {
    throw new Error("Failed to create server instance");
  }
} catch (err) {
  console.error("Failed to start server:", err);
  process.exit(1);
}
