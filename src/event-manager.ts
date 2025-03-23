/**
 * Event Manager - Centralized event handling system
 * Consolidates redundant event listeners and handlers
 */
import { analyze } from "./analyzer";
import { domManager } from "./dom-manager";
import { getCorrectGitHubUrl } from "./github/browser-utils";

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
      const handleSubmit = async (e?: Event) => {
        if (e) e.preventDefault();

        const urlInput = domManager.get("urlInput");
        const inputValue = urlInput.value.trim();

        console.log("Form submission triggered, input value:", inputValue);

        if (inputValue && inputValue.includes("github.com")) {
          await this.triggerAnalyze(inputValue);
        } else {
          console.error("Invalid URL or URL not provided");
        }
      };

      // Add event listener to form
      domManager.withElement("analyzeForm", (form) => {
        form.addEventListener("submit", (e) => void handleSubmit(e));
      });

      // Add click handler to button
      domManager.withElement("analyzeBtn", (button) => {
        button.addEventListener("click", (e) => {
          e.preventDefault(); // Prevent default form submission
          void handleSubmit();
        });
      });

      // Add keydown handler to input
      domManager.withElement("urlInput", (input) => {
        input.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault(); // Prevent default form submission
            void handleSubmit();
          }
        });

        // Handle manual submit events
        input.addEventListener("manualSubmit", () => {
          if (input.value.trim()) {
            void handleSubmit();
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
    // Check if we're in a production build
    const inProduction = window.location.hostname !== "localhost" &&
                        window.location.hostname !== "127.0.0.1";

    // Skip WebSocket entirely in production environments
    if (inProduction) {
      console.log('[PROD] Hot reload disabled in production environment');
      return;
    }

    // Only in development: Try to connect to WebSocket server
    console.log('[DEV] Setting up development hot reload');

    let reconnectTimeout: number | null = null;
    const connectWebSocket = () => {
      try {
        console.log('[DEV] Attempting to connect to WebSocket server...');
        const ws = new WebSocket("ws://localhost:8081");

        // Clear any pending reconnect timers when we connect
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }

        ws.onmessage = (event) => {
          if (event.data === "reload") {
            console.log("[DEV] Hot reload triggered, refreshing page...");
            window.location.reload();
          }
        };

        ws.onopen = () => {
          console.log('[DEV] WebSocket connection established');
        };

        ws.onclose = () => {
          if (!reconnectTimeout) {
            console.log("[DEV] WebSocket connection closed, will attempt to reconnect once");
            // Only try reconnecting once to avoid flood of reconnection attempts
            reconnectTimeout = window.setTimeout(connectWebSocket, 2000) as unknown as number;
          }
        };

        ws.onerror = () => {
          console.log('[DEV] WebSocket connection error, development server may not be running');
          // Don't try to reconnect on error
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
          }
        };
      } catch (error) {
        console.log('[DEV] Failed to initialize WebSocket connection');
      }
    };

    // Only try to connect on localhost
    if (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1") {
      connectWebSocket();
    }
  }

  /**
   * Trigger analysis with URL validation and duplicate prevention
   * @param {string} inputValue URL to analyze
   */
  public async triggerAnalyze(inputValue?: string): Promise<void> {
    try {
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

        // Check if the URL needs to be redirected (e.g., from issues to pull)
        const correctUrl = await getCorrectGitHubUrl(inputValue);

        // Update the URL in the input field if it changed
        if (correctUrl !== inputValue) {
          domManager.get("urlInput").value = correctUrl;
          history.replaceState(null, "", correctUrl);
        }

        // Store in localStorage for diagnostic purposes
        localStorage.setItem("last_manual_url", correctUrl);

        // Call analyze and reset the flag when done
        await analyze(correctUrl).finally(() => {
          this.analysisInProgress = false;
        });
      } else {
        console.error("Invalid URL or URL not provided");
      }
    } catch (error) {
      console.error("Error in triggerAnalyze:", error);
      this.analysisInProgress = false;
    }
  }

  /**
   * Load and analyze last URL if available
   */
  public async loadLastUrl(): Promise<void> {
    const lastUrl = localStorage.getItem("last_url");

    if (lastUrl) {
      domManager.withElement("urlInput", (input) => {
        input.value = lastUrl;
        void this.triggerAnalyze(lastUrl);
      });
    }
  }
}

// Export singleton instance
export const eventManager = new EventManager();
