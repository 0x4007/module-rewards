/**
 * Main Application Entry Point
 * Initializes the application and sets up event handlers
 */
import { marked } from "marked";
import { domManager } from "./dom-manager";
import { initAuthHandler } from "./dom-utils";
import { eventManager } from "./event-manager";
import "./utils/token-test"; // Register token test functions to window

// Make marked available globally for markdown rendering
declare global {
  interface Window {
    marked: typeof marked;
  }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("Initializing application...");

    // Initialize DOM manager - must be done first
    if (!domManager.initialize()) {
      throw new Error("Failed to initialize DOM manager");
    }

    // Initialize the auth handler to provide token input functionality
    initAuthHandler();

    // Initialize event handling system
    // This now includes URL query parameter processing
    eventManager.initialize();

    // Load last URL if available and no query parameter was processed
    // Note: processQueryParameters() is now called within initialize()
    eventManager.loadLastUrl();

    console.log("Application initialized successfully");
  } catch (error) {
    console.error("Failed to initialize application:", error);
    document.body.innerHTML = `
      <div class="error-message">
        Failed to initialize application: ${error instanceof Error ? error.message : String(error)}
      </div>`;
  }
});

import { grid } from "./the-grid";
grid(document.getElementById("grid") as HTMLElement, () => document.body.classList.add("grid-loaded")); // @DEV: display grid background
