/**
 * Analyzer - Main entry point for PR/Issue analysis
 * Handles fetching data from GitHub and displaying it in the UI
 */
import { renderComments } from "./components/comment-component";
import { renderScoreSummary } from "./components/score-summary-component";
import { ModuleChain } from "./core/module-chain";
import { domManager } from "./dom-manager";
import { ContentFilter } from "./modules/content-filter";
import { ScoringPipeline } from "./modules/scoring-pipeline";
import { ReadabilityScorer, TechnicalScorer } from "./scorers";
import { notifyContentUpdated, processGitHubData } from "./services/data-processor";
import { githubApiService } from "./services/github-api-service";

// Initialize scoring pipeline with default configuration
const scoringChain = new ModuleChain("scoring")
  .addModule(new ContentFilter())
  .addModule(
    new ScoringPipeline({
      scorers: [
        {
          scorer: new ReadabilityScorer({ targetScore: 70 }),
          weight: 0.6
        },
        {
          scorer: new TechnicalScorer({
            weights: {
              codeBlockQuality: 0.5,
              technicalTerms: 0.3,
              explanationQuality: 0.2
            }
          }),
          weight: 0.4
        }
      ],
      debug: true,
    })
  );

/**
 * Analyze a GitHub PR or Issue URL
 * Fetch data, process it, and display it in the UI
 */
export async function analyze(url: string): Promise<void> {
  try {
    if (!url || !url.includes("github.com")) {
      domManager.showError("Please enter a valid GitHub URL");
      return;
    }

    console.log("Starting analysis for URL:", url);

    // Parse GitHub URL
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

    // Add loading indicator to containers
    domManager.withElement("prConversation", element => {
      element.innerHTML = '<div class="section-loading-indicator"><div class="spinner"></div><span>Loading PR comments...</span></div>';
    });

    domManager.withElement("issueConversation", element => {
      element.innerHTML = '<div class="section-loading-indicator"><div class="spinner"></div><span>Loading issue comments...</span></div>';
    });

    // Fetch data from GitHub API with caching
    const data = await githubApiService.fetchData(
      parsedUrl.owner,
      parsedUrl.repo,
      parsedUrl.number,
      parsedUrl.type
    );

    // Process the data
    const { prComments, issueComments, prInfo, issueInfo } = processGitHubData(data);

    // Clear loading indicators
    domManager.clearContent("prConversation");
    domManager.clearContent("issueConversation");

    // Render comments
    renderComments("pr", prComments, "#pr-conversation",
      prInfo ? { title: prInfo, number: data.details.number.toString() } : undefined);

    renderComments("issue", issueComments, "#issue-conversation",
      issueInfo ? { title: issueInfo, number: data.details.number.toString() } : undefined);

    // Render score summary
    renderScoreSummary(prComments, issueComments);

    // Show both containers
    domManager.show("contentColumns");

    // Store URL in localStorage
    localStorage.setItem("last_url", url);

    // Do a background refresh after analysis to get latest data
    setTimeout(() => {
      if (parsedUrl) {
        backgroundRefresh(parsedUrl.owner, parsedUrl.repo, parsedUrl.number, parsedUrl.type);
      }
    }, 30000); // 30 seconds delay

  } catch (error) {
    console.error("Error analyzing content:", error);
    domManager.showError(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Do a background refresh of data
 */
async function backgroundRefresh(owner: string, repo: string, number: string, type: "pr" | "issue"): Promise<void> {
  try {
    console.log("Starting background refresh...");

    // Refresh data in background
    const refreshResult = await githubApiService.refreshCachedData(owner, repo, number, type);

    // If data was updated, update the UI
    if (refreshResult && refreshResult.updated) {
      console.log("Content updated, refreshing UI...");

      // Process the updated data
      const { prComments, issueComments, prInfo, issueInfo } = processGitHubData(refreshResult.data);

      // Clear previous content
      domManager.clearContent("prConversation");
      domManager.clearContent("issueConversation");

      // Render updated comments
      renderComments("pr", prComments, "#pr-conversation",
        prInfo ? { title: prInfo, number: refreshResult.data.details.number.toString() } : undefined);

      renderComments("issue", issueComments, "#issue-conversation",
        issueInfo ? { title: issueInfo, number: refreshResult.data.details.number.toString() } : undefined);

      // Update score summary
      renderScoreSummary(prComments, issueComments);

      // Show notification that content was updated
      notifyContentUpdated();
    }
  } catch (error) {
    console.error("Background refresh failed:", error);
    // Don't show user-facing error for background refresh
  }
}
