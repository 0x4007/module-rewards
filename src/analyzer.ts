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
    // Detect environment consistently across the application
    const inProduction = typeof window !== 'undefined' &&
                          window.location.hostname !== "localhost" &&
                          window.location.hostname !== "127.0.0.1";
    const envPrefix = inProduction ? '[PROD]' : '[DEV]';
    console.log(`${envPrefix} Analyzing URL: ${inputUrl}`);

    // Log all issues with linked PR detection for better visibility
    const issueMatch = inputUrl.match(/\/issues\/(\d+)/);
    if (issueMatch) {
      const issueNumber = issueMatch[1];
      console.log(`${envPrefix} Analyzing issue #${issueNumber} - monitoring linked PRs detection`);
    }

    // Parse the URL
    const parsedUrl = githubApiService.parseUrl(inputUrl);
    const { owner, repo, number, type } = parsedUrl;
    console.log(`${envPrefix} Parsed URL - Owner: ${owner}, Repo: ${repo}, Number: ${number}, Type: ${type}`);

    // Store last URL for future use
    localStorage.setItem("last_url", inputUrl);

    // Fetch data from GitHub
    console.log(`${envPrefix} Fetching data from GitHub API...`);
    const data = await githubApiService.fetchData(owner, repo, number, type);
    console.log(`${envPrefix} Data fetched successfully`);

    // Check for linked PRs if this is an issue
    if (type === 'issue' && data.linkedPullRequests) {
      if (data.linkedPullRequests.length > 0) {
        console.log(`${envPrefix} Linked PRs found:`,
          data.linkedPullRequests.map(pr => `#${pr.number} (${pr.state})`).join(', '));
      } else {
        console.log(`${envPrefix} No linked PRs found for issue #${number}`);
      }
    }

    // Process the data
    console.log(`${envPrefix} Processing GitHub data...`);
    const { prComments, issueComments, prInfo, issueInfo } = processGitHubData(data);
    console.log(`${envPrefix} Data processed: PR comments: ${prComments.length}, Issue comments: ${issueComments.length}`);

    // Display comments with sections
    let prTitle, prNumber, issueTitle, issueNumber;

    // Extract title and number information for the header
    if (type === 'pr') {
      prTitle = data.details.title;
      prNumber = data.details.number;
      // If there's a linked issue, extract its info
      if (data.linkedIssue) {
        issueTitle = data.linkedIssue.title;
        issueNumber = data.linkedIssue.number;
      }
    } else {
      // It's an issue
      issueTitle = data.details.title;
      issueNumber = data.details.number;
      // If there's a linked PR, extract its info
      if (data.linkedPullRequests && data.linkedPullRequests.length > 0) {
        const mainPR = data.linkedPullRequests[0];
        prTitle = mainPR.title;
        prNumber = mainPR.number;
      }
    }

    renderComments("pr", prComments, "#pr-conversation", calculateAllScores,
      prTitle ? { title: prTitle, number: prNumber } : undefined);
    renderComments("issue", issueComments, "#issue-conversation", calculateAllScores,
      issueTitle ? { title: issueTitle, number: issueNumber } : undefined);

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
  // Detect environment consistently
  const inProduction = typeof window !== 'undefined' &&
                      window.location.hostname !== "localhost" &&
                      window.location.hostname !== "127.0.0.1";
  const envPrefix = inProduction ? '[PROD]' : '[DEV]';

  // Wait a bit before checking for updates
  setTimeout(async () => {
    try {
      console.log(`${envPrefix} Starting background refresh for ${owner}/${repo}/${type}/${number}`);
      const result = await githubApiService.refreshCachedData(owner, repo, number, type);

      if (result && result.updated) {
        console.log(`${envPrefix} Content updated, refreshing display`);
        // Process and display updated data
        const { prComments, issueComments } = processGitHubData(result.data);

        // Clear existing content
        domManager.clearContent("issueConversation");
        domManager.clearContent("prConversation");

        // Extract title and number information for the headers (for updates)
        let prTitle, prNumber, issueTitle, issueNumber;

        if (result.data.type === 'pr') {
          prTitle = result.data.details.title;
          prNumber = result.data.details.number;
          if (result.data.linkedIssue) {
            issueTitle = result.data.linkedIssue.title;
            issueNumber = result.data.linkedIssue.number;
          }
        } else {
          // It's an issue
          issueTitle = result.data.details.title;
          issueNumber = result.data.details.number;
          if (result.data.linkedPullRequests && result.data.linkedPullRequests.length > 0) {
            const mainPR = result.data.linkedPullRequests[0];
            prTitle = mainPR.title;
            prNumber = mainPR.number;
          }
        }

        // Display updated comments
        renderComments("pr", prComments, "#pr-conversation", calculateAllScores,
          prTitle ? { title: prTitle, number: prNumber } : undefined);
        renderComments("issue", issueComments, "#issue-conversation", calculateAllScores,
          issueTitle ? { title: issueTitle, number: issueNumber } : undefined);

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
          console.error(`${envPrefix} Failed to update score summary:`, error);
        }

        // Show notification
        notifyContentUpdated();
      } else {
        console.log(`${envPrefix} No content updates found during background refresh`);
      }
    } catch (error) {
      console.error(`${envPrefix} Background refresh error:`, error);
    }
  }, 30000); // Check after 30 seconds
}
