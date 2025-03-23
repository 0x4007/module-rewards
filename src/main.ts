/**
 * Main Application Entry Point
 * Initializes the application and sets up event handlers
 */
import { marked } from "marked";
import { analyze } from "./analyzer";
import { domManager } from "./dom-manager";
import { eventManager } from "./event-manager";
import { grid } from "./the-grid";

// Make marked available globally for markdown rendering
declare global {
  interface Window {
    marked: typeof marked;
    directAnalyzeUrl: (url: string) => void;
  }
}

// Global fallback function for direct URL analysis without going through DOM manager
window.directAnalyzeUrl = async (url: string) => {
  try {
    console.log("Direct URL analysis triggered for:", url);
    if (url && url.includes("github.com")) {
      await analyze(url);
    } else {
      console.error("Invalid URL provided to directAnalyzeUrl");
    }
  } catch (error) {
    console.error("Error in directAnalyzeUrl:", error);
  }
};

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("Initializing application...");

    // Initialize DOM manager - must be done first
    if (!domManager.initialize()) {
      throw new Error("Failed to initialize DOM manager");
    }

    // Initialize event handling system
    // This now includes URL query parameter processing
    eventManager.initialize();

    // Initialize grid background
    const gridElement = document.getElementById("grid");
    if (!gridElement) {
      throw new Error("Grid element not found");
    }
    grid(gridElement);

    // Add grid-loaded class to body after initialization
    document.body.classList.add("grid-loaded");

    // Direct DOM manipulation fallback for form submission
    const form = document.getElementById("analyze-form");
    const input = document.getElementById("url-input") as HTMLInputElement;
    const button = document.getElementById("analyze-btn");

    if (form && input && button) {
      // Monitor input changes
      input.addEventListener("input", () => {
        console.log("Direct input monitoring - value:", input.value);
      });

      // Direct form handler
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const url = input.value.trim();
        console.log("Direct form submission with URL:", url);

        if (url && url.includes("github.com")) {
          window.directAnalyzeUrl(url);
        } else {
          console.error("Direct form handler - Invalid URL or URL not provided");
        }
      });

      // Direct button handler
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const url = input.value.trim();
        console.log("Direct button click with URL:", url);

        if (url && url.includes("github.com")) {
          window.directAnalyzeUrl(url);
        } else {
          console.error("Direct button handler - Invalid URL or URL not provided");
        }
      });
    }

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
