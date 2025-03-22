import { marked } from "marked";
import { analyze } from "./analyzer";

// Make marked available globally for markdown rendering
declare global {
  interface Window {
    marked: typeof marked;
  }
}

// DOM elements
export let urlInput: HTMLInputElement;
let analyzeBtn: HTMLButtonElement;
export let loadingIndicator: HTMLElement;
export let errorMessage: HTMLElement;
export let detailsElement: HTMLElement;
export let title: HTMLElement;
export let meta: HTMLElement;
export let issueConversation: HTMLElement;
export let prConversation: HTMLElement;
export let githubToken: string | null = localStorage.getItem("github_token");

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Initialize WebSocket connection for live reload
  let ws: WebSocket;
  const connectWebSocket = () => {
    try {
      ws = new WebSocket("ws://localhost:8081");
      ws.onmessage = (event) => {
        if (event.data === "reload") {
          console.log("Live reload: Refreshing page after TypeScript changes...");
          window.location.reload();
        }
      };
      ws.onclose = () => {
        console.log("WebSocket connection closed. Attempting to reconnect...");
        setTimeout(connectWebSocket, 1000);
      };
      ws.onerror = (error) => {
        console.warn("WebSocket connection error:", error);
      };
    } catch (error) {
      console.warn("WebSocket initialization failed:", error);
      setTimeout(connectWebSocket, 1000);
    }
  };

  connectWebSocket();

  try {
    // Initialize DOM elements
    urlInput = document.getElementById("url-input") as HTMLInputElement;
    analyzeBtn = document.getElementById("analyze-btn") as HTMLButtonElement;
    loadingIndicator = document.getElementById("loading-indicator") as HTMLElement;
    errorMessage = document.getElementById("error-message") as HTMLElement;
    detailsElement = document.getElementById("details") as HTMLElement;
    title = document.querySelector("#details .title") as HTMLElement;
    meta = document.querySelector("#details .meta") as HTMLElement;
    issueConversation = document.getElementById("issue-conversation") as HTMLElement;
    prConversation = document.getElementById("pr-conversation") as HTMLElement;

    // Add input monitoring for debugging
    urlInput?.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      console.log("Input changed:", target.value);
    });

    // Track if analysis is in progress to prevent multiple simultaneous calls
    let analysisInProgress = false;

    // Single function to trigger analysis
    const triggerAnalyze = (inputValue?: string) => {
      // Get the value from the input if not passed directly
      if (!inputValue) {
        inputValue = document.getElementById("url-input")
          ? (document.getElementById("url-input") as HTMLInputElement).value
          : "";
      }

      // Prevent multiple simultaneous calls
      if (analysisInProgress) {
        console.log("Analysis already in progress, ignoring duplicate call");
        return;
      }

      console.log("Triggering analysis for:", inputValue);

      if (inputValue && inputValue.includes("github.com")) {
        analysisInProgress = true;

        // Store in localStorage for diagnostic purposes
        localStorage.setItem("last_manual_url", inputValue);

        // Call analyze and reset the flag when done
        analyze(inputValue).finally(() => {
          analysisInProgress = false;
        });
      } else {
        console.error("Invalid URL or URL not provided");
      }
    };

    // Get reference to form and add submit handler
    const form = document.getElementById("analyze-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const inputValue = urlInput?.value;
        console.log("Form submit triggered, input value:", inputValue);
        triggerAnalyze(inputValue);
      });

      // Listen for manual submit events
      form.addEventListener("manualSubmit", () => {
        const inputValue = urlInput?.value;
        if (inputValue) {
          triggerAnalyze(inputValue);
        }
      });
    }

    // Verify all required elements are present
    if (
      !urlInput ||
      !analyzeBtn ||
      !loadingIndicator ||
      !errorMessage ||
      !detailsElement ||
      !title ||
      !meta ||
      !issueConversation ||
      !prConversation
    ) {
      throw new Error("Required DOM elements not found. Check HTML structure.");
    }

    // Create a single click handler for the analyze button
    document.getElementById("analyze-btn")?.addEventListener("click", (e) => {
      e.preventDefault(); // Prevent default form submission
      const inputElement = document.getElementById("url-input") as HTMLInputElement;
      console.log("Clicked Analyze button, input value:", inputElement.value);
      triggerAnalyze(inputElement.value);
    });

    document.getElementById("url-input")?.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault(); // Prevent default form submission
        const inputElement = e.target as HTMLInputElement;
        console.log("Pressed Enter, input value:", inputElement.value);
        triggerAnalyze(inputElement.value);
      }
    });

    // Restore and analyze last PR URL if exists
    const lastUrl = localStorage.getItem("last_url");
    if (lastUrl && urlInput) {
      urlInput.value = lastUrl;
      triggerAnalyze(lastUrl);
    }
  } catch (error) {
    console.error("Failed to initialize:", error);
    document.body.innerHTML = `<div class="error-message">Failed to initialize application: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
});
