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
    // Add debugging metadata about environment
    const isProduction = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
    const debugPrefix = isProduction ? '[PROD]' : '[DEV]';
    console.log(`${debugPrefix} Analyzing URL: ${inputUrl}`);

    // Log if this is issue #30 specifically (for debugging linked PR #31 issue)
    const isIssue30 = inputUrl.includes('/issues/30');
    if (isIssue30) {
      console.log(`${debugPrefix} 🔍 DEBUG: This is issue #30 - specifically watching for PR #31 loading issues`);
    }

    // Parse the URL
    const parsedUrl = githubApiService.parseUrl(inputUrl);
    const { owner, repo, number, type } = parsedUrl;
    console.log(`${debugPrefix} Parsed URL - Owner: ${owner}, Repo: ${repo}, Number: ${number}, Type: ${type}`);

    // Store last URL for future use
    localStorage.setItem("last_url", inputUrl);

    // Fetch data from GitHub
    console.log(`${debugPrefix} Fetching data from GitHub API...`);
    const data = await githubApiService.fetchData(owner, repo, number, type);
    console.log(`${debugPrefix} Data fetched successfully`);

    // Check for linked PRs if this is an issue
    if (type === 'issue' && data.linkedPullRequests) {
      console.log(`${debugPrefix} Linked PRs found:`,
        data.linkedPullRequests.map(pr => `#${pr.number} (${pr.state})`).join(', '));

      // Special debug for issue #30 / PR #31
      if (isIssue30) {
        const pr31 = data.linkedPullRequests.find(pr => pr.number === 31);
        if (pr31) {
          console.log(`${debugPrefix} 🎯 PR #31 found in linked PRs!`);
          console.log(`${debugPrefix} PR #31 data:`, {
            title: pr31.title,
            state: pr31.state,
            hasComments: Boolean(pr31.comments),
            commentsCount: pr31.comments ? pr31.comments.length : 0
          });
        } else {
          console.log(`${debugPrefix} ❌ PR #31 NOT found in linked PRs!`);
        }
      }
    }

    // Process the data
    console.log(`${debugPrefix} Processing GitHub data...`);
    const { prComments, issueComments, prInfo, issueInfo } = processGitHubData(data);
    console.log(`${debugPrefix} Data processed: PR comments: ${prComments.length}, Issue comments: ${issueComments.length}`);

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
