import { clearResults } from "./clearResults";
import { fetchGitHubData, parseUrl } from "./github-api";
import { detailsElement, errorMessage, issueConversation, loadingIndicator, meta, title, urlInput } from "./main";
import { processIssueComments } from "./processIssueComments";
import { processPRComments } from "./processPRComments";
import { promptForGitHubToken } from "./promptForGitHubToken";
import { showError } from "./showError";
import { FetchedData, GitHubComment, ScoringMetrics } from "./types";
import { updateContributorSummary } from "./updateContributorSummary";
import { updateSummary } from "./updateSummary";

// Analyze PR using user input
export async function analyze(inputUrl?: string): Promise<void> {
  // Clear previous results
  clearResults();

  // Show loading state
  loadingIndicator.classList.remove("hidden");
  errorMessage.classList.add("hidden");

  // Get URL - Try multiple methods to get the input value
  let url = "";

  // Start with the direct parameter if provided
  if (inputUrl) {
    url = inputUrl.trim();
    console.log("Method 0 - Got URL from direct parameter:", url);
  }

  // Method 1: Direct from the element reference (if no input parameter)
  if (!url && urlInput && urlInput.value) {
    url = urlInput.value.trim();
    console.log("Method 1 - Got URL from urlInput reference:", url);
  }

  // Method 2: Query the DOM directly (if still no URL)
  if (!url) {
    const directInput = document.getElementById("url-input") as HTMLInputElement;
    if (directInput && directInput.value) {
      url = directInput.value.trim();
      console.log("Method 2 - Got URL from direct DOM query:", url);
    }
  }

  // Method 3: Try localStorage backup from manual handler (as last resort)
  if (!url) {
    const backupUrl = localStorage.getItem("last_manual_url");
    if (backupUrl) {
      url = backupUrl;
      console.log("Method 3 - Got URL from localStorage backup:", url);
      // Clear it after using
      localStorage.removeItem("last_manual_url");
    }
  }

  console.log("Final URL to analyze:", url);

  if (!url) {
    showError("Please enter a GitHub PR or Issue URL");
    return;
  }

  // Basic validation for URL format
  if (!url.match(/github\.com\/[^\/]+\/[^\/]+\/(pull|pulls|issue|issues)\/\d+/i)) {
    console.error("Invalid URL format:", url);
    showError("Invalid URL format. Please enter a valid GitHub PR or Issue URL.");
    return;
  }

  // Save the URL for future use
  localStorage.setItem("last_url", url);

  try {
    // Parse URL
    const { owner, repo, number, type } = parseUrl(url);

    // Setup cache keys
    const cacheKey = `data-${url}`;
    const cachedData = localStorage.getItem(cacheKey);
    let data;

    // Function to create a simple hash of the data
    const hashData = (data: FetchedData): string => {
      const relevantData = {
        title: data.details.title,
        body: data.details.body,
        comments: data.comments.map((c) => ({
          id: c.id,
          body: c.body,
          updated_at: c.updated_at,
        })),
      };
      return JSON.stringify(relevantData);
    };

    // Function to process and display data
    const processAndDisplayData = (newData: FetchedData, oldData?: FetchedData, isBackgroundUpdate = false) => {
      // Only clear results if this is not a background update
      if (!isBackgroundUpdate) {
        clearResults();
      }

      // Update title and show containers
      title.textContent = `${newData.details.title} (#${newData.details.number})`;
      detailsElement.classList.remove("hidden");

      // Enhanced debugging for issue linkage
      console.log("Data loaded:", {
        hasBody: !!newData.details.body,
        hasLinkedIssue: !!newData.linkedIssue,
        linkedIssueNumber: newData.linkedIssue?.number,
        type: newData.type,
        owner: newData.details.user?.login,
        detailsNumber: newData.details.number,
      });

      // Log full linked issue data if present
      if (newData.linkedIssue) {
        console.log("LINKED ISSUE DETAILS:", {
          number: newData.linkedIssue.number,
          title: newData.linkedIssue.title,
          bodyExcerpt: newData.linkedIssue.body?.substring(0, 50) + "...",
          hasComments: !!newData.linkedIssue.comments && newData.linkedIssue.comments.length > 0,
          commentCount: newData.linkedIssue.comments?.length || 0,
        });
      }

      // First determine where to place content based on type
      const prComments: GitHubComment[] = [];
      const issueComments: GitHubComment[] = [];

      if (newData.type === "pr") {
        // For PR view: PR comments go in PR column, linked issue comments go in Issue column
        prComments.push(...newData.comments);

        // Add the PR initial body as a comment
        if (newData.details.body) {
          const prBodyComment: GitHubComment = {
            id: 0,
            body: newData.details.body,
            user: newData.details.user,
            created_at: newData.details.created_at,
            updated_at: newData.details.updated_at,
            html_url: newData.details.html_url,
          };
          prComments.unshift(prBodyComment); // Add at beginning
        }

        // Add a heading for the PR column
        meta.innerHTML += `<span class="meta-separator">|</span> <strong>Viewing PR #${newData.details.number}</strong>`;

        // If we have a linked issue, add its comments to the issue column
        if (newData.linkedIssue) {
          // Add a heading for the linked issue
          const issueHeader = document.createElement("div");
          issueHeader.className = "linked-content-header";
          issueHeader.innerHTML = `<h3>Linked Issue #${newData.linkedIssue.number}: ${newData.linkedIssue.title}</h3>`;
          issueConversation.appendChild(issueHeader);

          // First add the issue body as a comment
          const issueBodyComment: GitHubComment = {
            id: -1,
            body: newData.linkedIssue.body,
            user: { login: "unknown", html_url: "", avatar_url: "" }, // LinkedIssue type doesn't have user property
            created_at: "",
            updated_at: "",
            html_url: newData.linkedIssue.html_url,
          };
          issueComments.push(issueBodyComment);

          // Then add all comments if available
          if (newData.linkedIssue.comments) {
            issueComments.push(...newData.linkedIssue.comments);
          }
        }
      } else if (newData.type === "issue") {
        // For Issue view: Issue comments go in Issue column, linked PRs info go in PR column
        issueComments.push(...newData.comments);

        // Add the issue initial body as a comment
        if (newData.details.body) {
          const issueBodyComment: GitHubComment = {
            id: 0,
            body: newData.details.body,
            user: newData.details.user,
            created_at: newData.details.created_at,
            updated_at: newData.details.updated_at,
            html_url: newData.details.html_url,
          };
          issueComments.unshift(issueBodyComment); // Add at beginning
        }

        // If we have linked PRs with full conversation data
        if (newData.linkedPullRequests && newData.linkedPullRequests.length > 0) {
          const mainPR = newData.linkedPullRequests[0];

          // Add a heading for the linked PR
          const prHeader = document.createElement("div");
          prHeader.className = "linked-content-header";
          prHeader.innerHTML = `<h3>Linked PR #${mainPR.number}: ${mainPR.title}</h3>`;
          document.getElementById("pr-conversation")?.appendChild(prHeader);

          // Check if we have full PR data with comments
          if (mainPR.comments && Array.isArray(mainPR.comments)) {
            console.log(`Displaying ${mainPR.comments.length} comments from linked PR #${mainPR.number}`);

            // Add the PR body as the first comment if available
            if (mainPR.body) {
              const prBodyComment: GitHubComment = {
                id: -3,
                body: mainPR.body,
                user: {
                  login: mainPR.author.login,
                  html_url: mainPR.author.html_url || "",
                  avatar_url: mainPR.author.avatar_url || ""
                },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                html_url: mainPR.url,
              };
              prComments.push(prBodyComment);
            }

            // Add all PR comments
            prComments.push(...mainPR.comments);
          } else {
            // If we don't have full comment data, just show the PR references
            let prListHTML = `# Linked Pull Requests\n\n`;
            newData.linkedPullRequests.forEach((pr) => {
              const statusIcon = pr.state === "closed" ? "❌" : pr.state === "merged" ? "✅" : "⏳";
              prListHTML += `${statusIcon} [#${pr.number}: ${pr.title}](${pr.url}) by ${pr.author.login}\n\n`;
            });

            const prListComment: GitHubComment = {
              id: -2,
              body: prListHTML,
              user: { login: "system", html_url: "", avatar_url: "" },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              html_url: "",
            };
            prComments.push(prListComment);
          }
        }
      }

      // Process PR comments
      const prResults = processPRComments(prComments);

      // Process Issue comments
      const issueResults = processIssueComments(issueComments);

      // Combine all scores for summary
      const combinedScores: ScoringMetrics = {
        original: [...prResults.metrics.original, ...issueResults.metrics.original],
        logAdjusted: [...prResults.metrics.logAdjusted, ...issueResults.metrics.logAdjusted],
        exponential: [...prResults.metrics.exponential, ...issueResults.metrics.exponential]
      };

      // Update summary with combined metrics
      updateSummary(combinedScores);

      // Merge contributor data from both sources
      const combinedContributors: {
        [key: string]: {
          avatar: string;
          url: string;
          totalWords: number;
          originalScore: number;
          logAdjustedScore: number;
          exponentialScore: number;
          commentCount: number;
        };
      } = {};

      // Helper function to merge contributor data
      const mergeContributorData = (source: typeof prResults.contributors) => {
        Object.entries(source).forEach(([login, stats]) => {
          if (!combinedContributors[login]) {
            // Initialize if this contributor isn't in the combined data yet
            combinedContributors[login] = {
              avatar: stats.avatar,
              url: stats.url,
              totalWords: 0,
              originalScore: 0,
              logAdjustedScore: 0,
              exponentialScore: 0,
              commentCount: 0
            };
          }

          // Add the stats
          combinedContributors[login].totalWords += stats.totalWords;
          combinedContributors[login].originalScore += stats.originalScore;
          combinedContributors[login].logAdjustedScore += stats.logAdjustedScore;
          combinedContributors[login].exponentialScore += stats.exponentialScore;
          combinedContributors[login].commentCount += stats.commentCount;
        });
      };

      // Merge data from both PR and Issue comments
      mergeContributorData(prResults.contributors);
      mergeContributorData(issueResults.contributors);

      // Update the contributor summary display
      updateContributorSummary(combinedContributors);

      // If this is a background update and data has changed, show notification
      if (oldData && hashData(newData) !== hashData(oldData)) {
        const notification = document.createElement("div");
        notification.className = "update-notification";
        notification.textContent = "Content updated with latest data";
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: #4CAF50;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          z-index: 1000;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
        `;
        document.body.appendChild(notification);

        // Fade in
        setTimeout(() => (notification.style.opacity = "1"), 0);

        // Fade out and remove after 3 seconds
        setTimeout(() => {
          notification.style.opacity = "0";
          setTimeout(() => notification.remove(), 300);
        }, 3000);
      }
    };

    // Function to fetch fresh data
    const fetchFreshData = async () => {
      try {
            const freshData = await fetchGitHubData(owner, repo, number, type, localStorage.getItem("github_token") || undefined);
            const currentData = cachedData ? JSON.parse(cachedData) : undefined;
            // Cache the fresh data
            localStorage.setItem(cacheKey, JSON.stringify(freshData));
            localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
            // Update UI with fresh data only if changed
            processAndDisplayData(freshData, currentData, true);
      } catch (error) {
        // Only handle auth errors in background fetch
        if (error instanceof Error && error.message.includes("Authentication failed") && promptForGitHubToken()) {
          try {
            const freshData = await fetchGitHubData(owner, repo, number, type, localStorage.getItem("github_token") || undefined);
            const currentData = cachedData ? JSON.parse(cachedData) : undefined;
            localStorage.setItem(cacheKey, JSON.stringify(freshData));
            localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
            processAndDisplayData(freshData, currentData, true);
          } catch (retryError) {
            console.error("Background fetch failed after token retry:", retryError);
          }
        } else {
          console.error("Background fetch failed:", error);
        }
      }
    };

    // If we have cached data, use it immediately
    if (cachedData) {
      data = JSON.parse(cachedData);
      processAndDisplayData(data, undefined, false);

      // Start background fetch if cache is older than 5 minutes
      const cacheTimestamp = localStorage.getItem(`${cacheKey}-timestamp`);
      const FIVE_MINUTES = 5 * 60 * 1000;
      if (!cacheTimestamp || Date.now() - Number(cacheTimestamp) > FIVE_MINUTES) {
        fetchFreshData();
      }
    } else {
      // No cache, fetch data normally
      try {
        data = await fetchGitHubData(owner, repo, number, type, localStorage.getItem("github_token") || undefined);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
        processAndDisplayData(data, undefined, false);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Authentication failed") && promptForGitHubToken()) {
          try {
            data = await fetchGitHubData(owner, repo, number, type, localStorage.getItem("github_token") || undefined);
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
            processAndDisplayData(data);
          } catch (retryError) {
            throw retryError;
          }
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    loadingIndicator.classList.add("hidden");
  }
}
