/**
 * Token Button Helper - Adds a token input button to the UI when needed
 * This helps users authenticate when linked PRs are not loading
 */
import { addTokenInputButton } from "../dom-utils/auth-handler";

/**
 * Add a GitHub token input button to the PR section
 * This can be called when no linked PRs are found to help users authenticate
 */
export function addTokenButtonToPRSection(): void {
  // Check if we're in a production environment
  const inProduction =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  const envPrefix = inProduction ? "[PROD]" : "[DEV]";

  // Only show this in production as it's most likely a token issue there
  if (!inProduction) {
    return;
  }

  console.log(`${envPrefix} Adding GitHub token input button to PR section`);

  // Check if we have a token already
  const hasToken = Boolean(localStorage.getItem("github_token"));
  if (hasToken) {
    console.log(`${envPrefix} Token already exists, not adding button`);
    return;
  }

  // Add the button to the PR header area
  setTimeout(() => {
    try {
      // First try to add to the PR header if it exists
      const prHeader = document.querySelector("#pr-conversation .section-header");
      const issueContainer = document.querySelector("#issue-conversation");

      if (prHeader) {
        // Add the token button to the PR header
        addTokenInputButton("#pr-conversation .section-header");
        console.log(`${envPrefix} Added token button to PR section header`);
      }
      else if (issueContainer) {
        // Add a custom message to the PR section
        const prContainer = document.querySelector("#pr-conversation") as HTMLElement;
        if (prContainer) {
          // Create message container if it doesn't exist
          const messageDiv = document.createElement("div");
          messageDiv.className = "auth-message";
          messageDiv.innerHTML = `
            <div class="auth-message-content">
              <h3>GitHub Authentication Required</h3>
              <p>To view linked pull requests, you need to provide a GitHub token with 'repo' scope access.</p>
              <button class="auth-token-button">Add GitHub Token</button>
            </div>
          `;

          // Style the message
          const style = document.createElement("style");
          style.textContent = `
            .auth-message {
              margin: 20px 0;
              padding: 16px;
              background-color: #f6f8fa;
              border: 1px solid #e1e4e8;
              border-radius: 6px;
            }
            .auth-message-content {
              text-align: center;
            }
            .auth-message h3 {
              margin-top: 0;
            }
          `;
          document.head.appendChild(style);

          // Add at the beginning of the PR container
          if (prContainer.firstChild) {
            prContainer.insertBefore(messageDiv, prContainer.firstChild);
          } else {
            prContainer.appendChild(messageDiv);
          }

          console.log(`${envPrefix} Added token message to PR container`);
        }
      }
    } catch (e) {
      console.error(`${envPrefix} Error adding token button:`, e);
    }
  }, 1000); // Slight delay to ensure DOM is ready
}

// Export a function that attaches an observer to automatically add a token button
// when linked PRs are not found
export function setupTokenButtonObserver(): void {
  if (typeof window === "undefined") return;

  // Check if we're in a production environment
  const inProduction =
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

  // Only run in production
  if (!inProduction) return;

  console.log("[PROD] Setting up token button observer");

  // Set up an observer for the PR section
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        const prSection = document.querySelector("#pr-conversation");
        if (prSection && prSection.childElementCount === 0) {
          // Empty PR section detected, might need to add token button
          addTokenButtonToPRSection();
          break;
        }
      }
    }
  });

  // Start observing once the page is loaded
  window.addEventListener("load", () => {
    const container = document.querySelector("#app-container");
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
      console.log("[PROD] Token button observer started");
    }
  });
}

// Automatically set up the observer when this module is loaded
setupTokenButtonObserver();
