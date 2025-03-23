/**
 * Analyzer - Main entry point for PR/Issue analysis
 * Uses server-side API for GitHub data fetching and content scoring
 */
import { renderComments } from "./components/comment-component";
import { renderScoreSummary } from "./components/score-summary-component";
import { domManager } from "./dom-manager";
import { getCorrectGitHubUrl } from "./github/browser-utils";
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
  hash?: string; // Content hash to detect changes
}

/**
 * Generate a hash of the content to detect changes
 */
function generateContentHash(data: ServerAnalysisResponse): string {
  const content = JSON.stringify({
    pr: data.prComments.map(c => ({ id: c.id, body: c.body, updated_at: c.updated_at })),
    issue: data.issueComments.map(c => ({ id: c.id, body: c.body, updated_at: c.updated_at }))
  });
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const chr = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Render the analyzed data
 */
async function renderData(data: ServerAnalysisResponse): Promise<void> {
  const { prComments, issueComments, prInfo, issueInfo } = data;

  // Extract number from PR or issue info for rendering
  const number = prInfo?.match(/#(\d+)/) || issueInfo?.match(/#(\d+)/);
  const numberStr = number ? number[1] : "";

  // Clear previous content
  domManager.clearContent("prConversation");
  domManager.clearContent("issueConversation");

  // Render comments
  renderComments("pr", prComments, "#pr-conversation",
    prInfo ? { title: prInfo, number: numberStr } : undefined);

  renderComments("issue", issueComments, "#issue-conversation",
    issueInfo ? { title: issueInfo, number: numberStr } : undefined);

  // Render score summary
  renderScoreSummary(prComments, issueComments);

  // Show both containers
  domManager.show("contentColumns");
}

/**
 * Check if data needs refresh based on last check time
 */
function needsRefresh(url: string): boolean {
  const lastCheck = localStorage.getItem(`${url}-lastCheck`);
  if (!lastCheck) return true;

  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return (now - parseInt(lastCheck)) > fiveMinutes;
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

    // Parse and validate URL, checking if it's actually a PR vs Issue
    let parsedUrl = githubApiService.parseUrl(url);
    if (!parsedUrl) {
      domManager.showError("Invalid GitHub URL format");
      return;
    }

    // Check if URL points to correct type (PR vs Issue)
    const correctUrl = await getCorrectGitHubUrl(url);
    if (correctUrl !== url) {
      console.log("URL type corrected:", correctUrl);
      const newParsed = githubApiService.parseUrl(correctUrl);
      if (!newParsed) {
        domManager.showError("Failed to parse corrected URL");
        return;
      }
      // Update both URL and parsed info
      url = correctUrl;
      parsedUrl = newParsed;
      uiStateManager.notify(`Type corrected: This is actually a ${parsedUrl.type === "pr" ? "Pull Request" : "Issue"}`, {
        type: "info"
      });
      console.log("Using corrected URL:", url, "of type:", parsedUrl.type);
    } else {
      console.log("URL verified as:", parsedUrl.type);
    }

    // Clear previous content
    domManager.clearContent("prConversation");
    domManager.clearContent("issueConversation");
    domManager.clearContent("scoreSummaryContent");
    domManager.hide("scoreSummary");

    // Register containers but don't show loading state yet
    domManager.withElement("prConversation", element => {
      uiStateManager.registerContainer("pr", element);
    });

    domManager.withElement("issueConversation", element => {
      uiStateManager.registerContainer("issue", element);
    });

    // Try to get data from localStorage first
    let initialData: ServerAnalysisResponse | null = null;
    try {
      const localData = localStorage.getItem(`${url}-data`);
      if (localData) {
        initialData = JSON.parse(localData) as ServerAnalysisResponse;
        // Render instantly from localStorage
        await renderData(initialData);
        console.log("Rendered from localStorage");
      }
    } catch (error) {
      console.warn("localStorage parse failed:", error);
    }

    // Store URL in localStorage
    localStorage.setItem("last_url", url);

    // If no localStorage data, show loading state
    if (!initialData) {
      uiStateManager.startLoading("pr");
      uiStateManager.startLoading("issue");
    }

    // Function to fetch data from server
    async function fetchFromServer(useCache: boolean = false) {
      try {
        const response = await fetch(API_ENDPOINTS.ANALYZE, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url,
            type: parsedUrl?.type || "issue",
            forceGitHub: !useCache,
            verifyType: true,
            useCache
          })
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        return await response.json() as ServerAnalysisResponse;
      } catch (error) {
        console.warn("Server fetch failed:", error);
        return null;
      }
    }

    // Initial fetch if no cached data
    if (!initialData) {
      console.log("No cached data, fetching...");
      try {
        const data = await fetchFromServer(false);
        if (!data) {
          throw new Error("Failed to fetch data");
        }

        const hash = generateContentHash(data);
        localStorage.setItem(`${url}-hash`, hash);
        localStorage.setItem(`${url}-data`, JSON.stringify(data));
        localStorage.setItem(`${url}-lastCheck`, Date.now().toString());
        await renderData(data);
      } catch (error) {
        console.warn("Initial fetch failed:", error);
        throw error;
      } finally {
        uiStateManager.stopLoading("pr");
        uiStateManager.stopLoading("issue");
      }
    } else if (needsRefresh(url)) {
      // Check for updates after a delay if data is stale
      console.log("Will check for updates in background...");
      setTimeout(async () => {
        const freshData = await fetchFromServer(false);
        if (!freshData) return;

        const freshHash = generateContentHash(freshData);
        const currentHash = localStorage.getItem(`${url}-hash`);

        if (currentHash !== freshHash) {
          await renderData(freshData);
          uiStateManager.notify("Content updated with latest changes", { type: "success" });
          localStorage.setItem(`${url}-hash`, freshHash);
          localStorage.setItem(`${url}-data`, JSON.stringify(freshData));
          localStorage.setItem(`${url}-lastCheck`, Date.now().toString());
        }
      }, 2000); // Check after 2 seconds
    }
  } catch (error) {
    console.error("Error analyzing content:", error);
    domManager.showError(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
