/**
 * Analyzer - Main entry point for PR/Issue analysis
 * Uses server-side API for GitHub data fetching and content scoring
 */
import { renderComments } from "./components/comment-component";
import { renderScoreSummary } from "./components/score-summary-component";
import { domManager } from "./dom-manager";
import { githubApiService } from "./services/github-api-service";
import { uiStateManager } from "./services/ui-state-manager";
import { GitHubComment } from "./types";

// Server API endpoints
const API_ENDPOINTS = {
  ANALYZE: "/api/analyze",
  SCORE: "/api/score"
};

// Interface for the server API response
interface ServerAnalysisResponse {
  prComments: GitHubComment[];
  issueComments: GitHubComment[];
  prInfo?: string;
  issueInfo?: string;
}

/**
 * Analyze a GitHub PR or Issue URL
 * Use server API to fetch, process, and score the data
 */
export async function analyze(url: string): Promise<void> {
  try {
    if (!url || !url.includes("github.com")) {
      domManager.showError("Please enter a valid GitHub URL");
      return;
    }

    console.log("Starting analysis for URL:", url);

    // Parse GitHub URL (client-side validation before sending to server)
    const parsedUrl = githubApiService.parseUrl(url);
    if (!parsedUrl) {
      domManager.showError("Invalid GitHub URL format");
      return;
    }

    console.log("Parsed GitHub URL:", parsedUrl);

    // Clear previous content
    domManager.clearContent("prConversation");
    domManager.clearContent("issueConversation");
    domManager.clearContent("scoreSummaryContent");
    domManager.hide("scoreSummary");

    // Initialize containers with loading states
    domManager.withElement("prConversation", element => {
      uiStateManager.registerContainer("pr", element);
      uiStateManager.startLoading("pr");
    });

    domManager.withElement("issueConversation", element => {
      uiStateManager.registerContainer("issue", element);
      uiStateManager.startLoading("issue");
    });

    // Use server-side API to fetch and analyze data
    const response = await fetch(API_ENDPOINTS.ANALYZE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    // Parse response
    const { prComments, issueComments, prInfo, issueInfo } = await response.json() as ServerAnalysisResponse;

    // Stop loading states
    uiStateManager.stopLoading("pr");
    uiStateManager.stopLoading("issue");

    // Extract number from PR or issue info for rendering
    const number = prInfo?.match(/#(\d+)/) || issueInfo?.match(/#(\d+)/);
    const numberStr = number ? number[1] : "";

    // Render comments
    renderComments("pr", prComments, "#pr-conversation",
      prInfo ? { title: prInfo, number: numberStr } : undefined);

    renderComments("issue", issueComments, "#issue-conversation",
      issueInfo ? { title: issueInfo, number: numberStr } : undefined);

    // Render score summary
    renderScoreSummary(prComments, issueComments);

    // Show both containers
    domManager.show("contentColumns");

    // Store URL in localStorage
    localStorage.setItem("last_url", url);

    // Do a background refresh after analysis to get latest data
    setTimeout(() => {
      backgroundRefresh(url);
    }, 30000); // 30 seconds delay

  } catch (error) {
    console.error("Error analyzing content:", error);
    domManager.showError(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Do a background refresh of data using the server API
 */
async function backgroundRefresh(url: string): Promise<void> {
  try {
    console.log("Starting background refresh...");

    // Use server API to refresh data
    const response = await fetch(API_ENDPOINTS.ANALYZE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        refresh: true // Tell server this is a refresh request
      })
    });

    if (!response.ok) {
      console.warn("Background refresh failed:", response.status);
      return;
    }

    // Parse response
    const { prComments, issueComments, prInfo, issueInfo } = await response.json() as ServerAnalysisResponse;

    // Extract number from PR or issue info for rendering
    const number = prInfo?.match(/#(\d+)/) || issueInfo?.match(/#(\d+)/);
    const numberStr = number ? number[1] : "";

    // Clear previous content
    domManager.clearContent("prConversation");
    domManager.clearContent("issueConversation");

    // Render updated comments
    renderComments("pr", prComments, "#pr-conversation",
      prInfo ? { title: prInfo, number: numberStr } : undefined);

    renderComments("issue", issueComments, "#issue-conversation",
      issueInfo ? { title: issueInfo, number: numberStr } : undefined);

    // Update score summary
    renderScoreSummary(prComments, issueComments);

    // Show notification that content was updated
    uiStateManager.notifyContentUpdated();
  } catch (error) {
    console.error("Background refresh failed:", error);
    // Don't show user-facing error for background refresh
  }
}
