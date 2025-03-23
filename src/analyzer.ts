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

    // If we have no data at all, fetch immediately
    if (!initialData) {
      console.log("No cached data, fetching...");
      try {
        const response = await fetch(API_ENDPOINTS.ANALYZE, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url,
            forceGitHub: true
          })
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json() as ServerAnalysisResponse;
        const hash = generateContentHash(data);
        localStorage.setItem(`${url}-hash`, hash);
        localStorage.setItem(`${url}-data`, JSON.stringify(data));
        localStorage.setItem(`${url}-lastCheck`, Date.now().toString());

        await renderData(data);
      } catch (error) {
        console.warn("Data fetch failed:", error);
        throw error;
      } finally {
        uiStateManager.stopLoading("pr");
        uiStateManager.stopLoading("issue");
      }
    } else if (needsRefresh(url)) {
      // We have data but it's stale - check for updates after a delay
      console.log("Will check for updates in background...");
      setTimeout(async () => {
        try {
          // Try cache API and fresh GitHub data in parallel
          const [cachedData, freshData] = await Promise.all([
          // Try server cache
          fetch(API_ENDPOINTS.ANALYZE, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              url,
              useCache: true
            })
          }).then(r => r.json()).catch(() => null),

            // Fresh GitHub data
            fetch(API_ENDPOINTS.ANALYZE, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                url,
                forceGitHub: true
              })
            }).then(r => r.json()).catch(() => null)
          ]);

          if (freshData) {
            const freshHash = generateContentHash(freshData);
            const currentHash = localStorage.getItem(`${url}-hash`);

            if (currentHash !== freshHash) {
              await renderData(freshData);
              uiStateManager.notifyContentUpdated();
              localStorage.setItem(`${url}-hash`, freshHash);
              localStorage.setItem(`${url}-data`, JSON.stringify(freshData));
              localStorage.setItem(`${url}-lastCheck`, Date.now().toString());
            }
          }
        } catch (error) {
          console.warn("Background refresh failed:", error);
        }
      }, 2000); // Check after 2 seconds
    }
  } catch (error) {
    console.error("Error analyzing content:", error);
    domManager.showError(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
