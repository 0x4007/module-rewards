/**
 * Event Manager - Centralized event handling system
 * Consolidates redundant event listeners and handlers
 */
import { analyze } from "./analyzer";
import { domManager } from "./dom-manager";

class EventManager {
  private initialized = false;
  private analysisInProgress = false;

  /**
   * Initialize all event listeners
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    this.setupFormSubmission();
    this.setupInputMonitoring();
    this.setupWebSocket();

    this.initialized = true;
  }

  /**
   * Set up form submission handler
   * Consolidates the three separate event handlers from main.ts
   */
  private setupFormSubmission(): void {
    try {
      // Single event handler for form submission
      const handleSubmit = (e?: Event) => {
        if (e) e.preventDefault();

        const urlInput = domManager.get("urlInput");
        const inputValue = urlInput.value.trim();

        console.log("Form submission triggered, input value:", inputValue);

        if (inputValue && inputValue.includes("github.com")) {
          this.triggerAnalyze(inputValue);
        } else {
          console.error("Invalid URL or URL not provided");
        }
      };

      // Add event listener to form
      domManager.withElement("analyzeForm", (form) => {
        form.addEventListener("submit", handleSubmit);
      });

      // Add click handler to button
      domManager.withElement("analyzeBtn", (button) => {
        button.addEventListener("click", (e) => {
          e.preventDefault(); // Prevent default form submission
          handleSubmit();
        });
      });

      // Add keydown handler to input
      domManager.withElement("urlInput", (input) => {
        input.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault(); // Prevent default form submission
            handleSubmit();
          }
        });

        // Handle manual submit events
        input.addEventListener("manualSubmit", () => {
          if (input.value.trim()) {
            handleSubmit();
          }
        });
      });
    } catch (error) {
      console.error("Error setting up form submission:", error);
    }
  }

  /**
   * Set up input monitoring for debugging
   */
  private setupInputMonitoring(): void {
    domManager.withElement("urlInput", (input) => {
      input.addEventListener("input", (e) => {
        const target = e.target as HTMLInputElement;
        console.log("Input changed:", target.value);
      });
    });
  }

  /**
   * Set up WebSocket connection for live reload
   */
  private setupWebSocket(): void {
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
  }

  /**
   * Trigger analysis with URL validation and duplicate prevention
   * @param {string} inputValue URL to analyze
   */
  public triggerAnalyze(inputValue?: string): void {
    // Get the value from the input if not passed directly
    if (!inputValue) {
      inputValue = domManager.get("urlInput").value.trim();
    }

    // Prevent multiple simultaneous calls
    if (this.analysisInProgress) {
      console.log("Analysis already in progress, ignoring duplicate call");
      return;
    }

    console.log("Triggering analysis for:", inputValue);

    if (inputValue && inputValue.includes("github.com")) {
      this.analysisInProgress = true;

      // Store in localStorage for diagnostic purposes
      localStorage.setItem("last_manual_url", inputValue);

      // Call analyze and reset the flag when done
      analyze(inputValue).finally(() => {
        this.analysisInProgress = false;
      });
    } else {
      console.error("Invalid URL or URL not provided");
    }
  }

  /**
   * Load and analyze last URL if available
   */
  public loadLastUrl(): void {
    const lastUrl = localStorage.getItem("last_url");

    if (lastUrl) {
      domManager.withElement("urlInput", (input) => {
        input.value = lastUrl;
        this.triggerAnalyze(lastUrl);
      });
    }
  }
}

// Export singleton instance
export const eventManager = new EventManager();
