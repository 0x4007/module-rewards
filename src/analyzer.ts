/**
 * GitHub Analyzer - Main module for analyzing GitHub content
 * Refactored to use modular components and services
 */
import { renderComments } from "./components/comment-component";
import { domManager } from "./dom-manager";
import { calculateAllScores } from "./scoring-utils";
import { notifyContentUpdated, processGitHubData } from "./services/data-processor";
import { githubApiService } from "./services/github-api-service";
import { uiStateManager } from "./ui-state-manager";

/**
 * Process and display content for a GitHub issue or PR
 */
export async function analyze(inputUrl: string): Promise<void> {
  if (!inputUrl || !inputUrl.includes("github.com")) {
    showError("Please enter a valid GitHub URL");
    return;
  }

  // Show global loading state
  domManager.show("loadingIndicator");

  // Initialize UI state manager with containers
  uiStateManager.registerContainer("issue", domManager.get("issueConversation"));
  uiStateManager.registerContainer("pr", domManager.get("prConversation"));

  // Clear previous content
  clearResults();
  uiStateManager.clearSection("issue");
  uiStateManager.clearSection("pr");

  // Start loading state for both sections
  uiStateManager.startLoading("issue");
  uiStateManager.startLoading("pr");

  try {
    // Parse the URL
    const parsedUrl = githubApiService.parseUrl(inputUrl);
    const { owner, repo, number, type } = parsedUrl;

    // Store last URL for future use
    localStorage.setItem("last_url", inputUrl);

    // Fetch data from GitHub
    const data = await githubApiService.fetchData(owner, repo, number, type);

    // Process the data
    const { prComments, issueComments, prInfo, issueInfo } = processGitHubData(data);

    // Show essential information
    domManager.show("detailsElement");
    domManager.setText("title", `${data.details.title} (#${data.details.number})`);

    // Set metadata information if available
    let metaHTML = "";
    if (prInfo) {
      metaHTML += `<span class="meta-separator">|</span> <strong>${prInfo}</strong>`;
    }
    if (issueInfo) {
      metaHTML += `<span class="meta-separator">|</span> <strong>${issueInfo}</strong>`;
    }

    domManager.withElement("meta", (element) => {
      element.innerHTML = metaHTML.startsWith("<span") ? metaHTML.substring(30) : metaHTML;
    });

    // Display comments with sections
    renderComments("pr", prComments, "#pr-conversation", calculateAllScores);
    renderComments("issue", issueComments, "#issue-conversation", calculateAllScores);

    // Set content loaded state for UI
    uiStateManager.setContentLoaded("pr", prComments.length > 0);
    uiStateManager.setContentLoaded("issue", issueComments.length > 0);

    // Generate the score summary from both sets of comments
    try {
      // Using dynamic import to avoid circular dependencies
      import("./components/score-summary-component").then((summaryModule) => {
        if (typeof summaryModule.renderScoreSummary === "function") {
          // Import scoreMap from comment-component
          import("./components/comment-component").then((commentModule) => {
            // Only show score summary if we have comments
            if (prComments.length > 0 || issueComments.length > 0) {
              summaryModule.renderScoreSummary(prComments, issueComments, commentModule.scoreMap);
            }
          });
        }
      });
    } catch (error) {
      console.error("Failed to render score summary:", error);
    }

    // Perform background refresh to check for updates
    backgroundRefresh(owner, repo, number, type, data);
  } catch (error) {
    uiStateManager.setError("issue", error instanceof Error ? error.message : String(error));
    uiStateManager.setError("pr", error instanceof Error ? error.message : String(error));
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    domManager.hide("loadingIndicator");
  }
}

/**
 * Clear previous results
 */
function clearResults(): void {
  // Reset title and meta
  domManager.setText("title", "");
  domManager.setText("meta", "");

  // Clear score summary
  domManager.clearContent("scoreSummaryContent");
  domManager.hide("scoreSummary");

  // Clear conversation containers
  domManager.clearContent("issueConversation");
  domManager.clearContent("prConversation");
}

/**
 * Display error message
 */
function showError(message: string): void {
  domManager.withElement("errorMessage", (element) => {
    element.textContent = message;
    element.classList.remove("hidden");

    // Hide after 5 seconds
    setTimeout(() => element.classList.add("hidden"), 5000);
  });
}

/**
 * Perform background refresh to check for updates
 */
async function backgroundRefresh(
  owner: string,
  repo: string,
  number: string,
  type: "pr" | "issue",
  originalData: any
): Promise<void> {
  // Wait a bit before checking for updates
  setTimeout(async () => {
    try {
      const result = await githubApiService.refreshCachedData(owner, repo, number, type);

      if (result && result.updated) {
        // Process and display updated data
        const { prComments, issueComments } = processGitHubData(result.data);

        // Clear existing content
        domManager.clearContent("issueConversation");
        domManager.clearContent("prConversation");

        // Display updated comments
        renderComments("pr", prComments, "#pr-conversation", calculateAllScores);
        renderComments("issue", issueComments, "#issue-conversation", calculateAllScores);

        // Update UI state
        uiStateManager.setContentLoaded("pr", prComments.length > 0);
        uiStateManager.setContentLoaded("issue", issueComments.length > 0);

        // Update the score summary
        try {
          import("./components/score-summary-component").then((summaryModule) => {
            if (typeof summaryModule.renderScoreSummary === "function") {
              import("./components/comment-component").then((commentModule) => {
                if (prComments.length > 0 || issueComments.length > 0) {
                  summaryModule.renderScoreSummary(prComments, issueComments, commentModule.scoreMap);
                }
              });
            }
          });
        } catch (error) {
          console.error("Failed to update score summary:", error);
        }

        // Show notification
        notifyContentUpdated();
      }
    } catch (error) {
      console.error("Background refresh error:", error);
    }
  }, 30000); // Check after 30 seconds
}
