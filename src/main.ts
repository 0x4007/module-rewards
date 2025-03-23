/**
 * Main Application Entry Point
 * Initializes the application and sets up event handlers
 */
import { marked } from "marked";
import { domManager } from "./dom-manager";
import { initAuthHandler } from "./dom-utils";
import { eventManager } from "./event-manager";
import "./utils/token-button-helper"; // Setup token button observer
import "./utils/token-test"; // Register token test functions to window

// Make marked available globally for markdown rendering
// Add custom extensions for token handling
declare global {
  interface Window {
    marked: typeof marked;
    notifyTokenUpdated: (token: string) => boolean;
    handleTokenUpdate: () => void;
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

// Handler for token updates
window.notifyTokenUpdated = function(token: string): boolean {
  console.log("Token update received in main application");
  return true;
};

// Handle token updates by refreshing API client and reloading current view
window.handleTokenUpdate = function(): void {
  console.log("Handling token update...");

  // Get current GitHub URL from input
  const urlInput = document.getElementById("urlInput") as HTMLInputElement;
  if (urlInput && urlInput.value && urlInput.value.includes("github.com")) {
    console.log("Refreshing view with new token...");

    // Clear caches with the old token
    try {
      const cacheKeyPattern = /^data-.*-noauth-/;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && cacheKeyPattern.test(key)) {
          console.log("Clearing cache entry:", key);
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error("Error clearing cache:", e);
    }

    // Re-trigger analysis
    const eventTrigger = new Event("manualSubmit");
    urlInput.dispatchEvent(eventTrigger);
  }
};

// Set up a global event listener for GitHub token related messages
window.addEventListener("message", function(event) {
  // Only process messages from our own domain
  if (event.origin !== window.location.origin) return;

  // Handle token update messages
  if (event.data && event.data.type === "github_token_updated") {
    console.log("Received token update message");
    if (window.handleTokenUpdate) {
      window.handleTokenUpdate();
    }
  }
});

import { grid } from "./the-grid";
grid(document.getElementById("grid") as HTMLElement, () => document.body.classList.add("grid-loaded")); // @DEV: display grid background
