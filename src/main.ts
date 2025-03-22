import { marked } from "marked";
import { fetchGitHubData, parseUrl } from "./github-api";
import { calculateAllScores } from "./scoring-utils";
import { CommentScores, FetchedData, GitHubComment, ScoringMetrics } from "./types";

// Make marked available globally for markdown rendering
declare global {
  interface Window {
    marked: typeof marked;
  }
}

// DOM elements
let urlInput: HTMLInputElement;
let analyzeBtn: HTMLButtonElement;
let loadingIndicator: HTMLElement;
let errorMessage: HTMLElement;
let detailsElement: HTMLElement;
let title: HTMLElement;
let meta: HTMLElement;
let conversation: HTMLElement;
let githubToken: string | null = localStorage.getItem("github_token");

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Initialize WebSocket connection for live reload
  let ws: WebSocket;
  const connectWebSocket = () => {
    try {
      ws = new WebSocket("ws://localhost:8081");
      ws.onmessage = (event) => {
        if (event.data === "reload") {
          console.log("Live reload: Refreshing page after TypeScript changes...");
          window.location.reload();
        }
      };
      ws.onclose = () => {
        console.log("WebSocket connection closed. Attempting to reconnect...");
        setTimeout(connectWebSocket, 1000);
      };
      ws.onerror = (error) => {
        console.warn("WebSocket connection error:", error);
      };
    } catch (error) {
      console.warn("WebSocket initialization failed:", error);
      setTimeout(connectWebSocket, 1000);
    }
  };

  connectWebSocket();

  try {
    // Initialize DOM elements
    urlInput = document.getElementById("url-input") as HTMLInputElement;
    analyzeBtn = document.getElementById("analyze-btn") as HTMLButtonElement;
    loadingIndicator = document.getElementById("loading-indicator") as HTMLElement;
    errorMessage = document.getElementById("error-message") as HTMLElement;
    detailsElement = document.getElementById("details") as HTMLElement;
    title = document.querySelector("#details .title") as HTMLElement;
    meta = document.querySelector("#details .meta") as HTMLElement;
    conversation = document.getElementById("conversation") as HTMLElement;

    // Add input monitoring for debugging
    urlInput?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      console.log('Input changed:', target.value);
    });

    // Get reference to form and add submit handler
    const form = document.getElementById('analyze-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputValue = urlInput?.value;
        console.log('Form submit triggered, input value:', inputValue);

        // Force URL validation and submission
        if (inputValue && inputValue.includes('github.com')) {
          // Store in localStorage for diagnostic purposes
          localStorage.setItem('last_manual_url', inputValue);
          analyze(inputValue);
        }
      });

      // Listen for manual submit events
      form.addEventListener('manualSubmit', () => {
        const inputValue = urlInput?.value;
        if (inputValue) {
          analyze(inputValue);
        }
      });
    }

    // Verify all required elements are present
    if (
      !urlInput ||
      !analyzeBtn ||
      !loadingIndicator ||
      !errorMessage ||
      !detailsElement ||
      !title ||
      !meta ||
      !conversation
    ) {
      throw new Error("Required DOM elements not found. Check HTML structure.");
    }

    // Create direct event listeners that access the DOM directly
    document.getElementById("analyze-btn")?.addEventListener("click", () => {
      const inputElement = document.getElementById("url-input") as HTMLInputElement;
      console.log("Clicked Analyze button, input value:", inputElement.value);
      analyze(inputElement.value);
    });

    document.getElementById("url-input")?.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const inputElement = e.target as HTMLInputElement;
        console.log("Pressed Enter, input value:", inputElement.value);
        analyze(inputElement.value);
      }
    });

    // Restore and analyze last PR URL if exists
    const lastUrl = localStorage.getItem("last_url");
    if (lastUrl && urlInput) {
      urlInput.value = lastUrl;
      analyze();
    }
  } catch (error) {
    console.error("Failed to initialize:", error);
    document.body.innerHTML = `<div class="error-message">Failed to initialize application: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
});

// Handle GitHub token input
function promptForGitHubToken(): boolean {
  const token = prompt(
    "GitHub API requires authentication for better rate limits.\nPlease enter your GitHub personal access token:",
    githubToken || ""
  );

  if (token) {
    githubToken = token;
    localStorage.setItem("github_token", token);
    return true;
  }

  return false;
}

// Analyze PR using user input
async function analyze(inputUrl?: string): Promise<void> {
  // Clear previous results
  clearResults();

  // Show loading state
  loadingIndicator.classList.remove("hidden");
  errorMessage.classList.add("hidden");

  // Get URL - Try multiple methods to get the input value
  let url = '';

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
    const directInput = document.getElementById('url-input') as HTMLInputElement;
    if (directInput && directInput.value) {
      url = directInput.value.trim();
      console.log("Method 2 - Got URL from direct DOM query:", url);
    }
  }

  // Method 3: Try localStorage backup from manual handler (as last resort)
  if (!url) {
    const backupUrl = localStorage.getItem('last_manual_url');
    if (backupUrl) {
      url = backupUrl;
      console.log("Method 3 - Got URL from localStorage backup:", url);
      // Clear it after using
      localStorage.removeItem('last_manual_url');
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
    const processAndDisplayData = (newData: FetchedData, oldData?: FetchedData) => {
      // Only clear results if this is not a background update
      if (!oldData) {
        clearResults();
      }

      // Update title and show containers
      title.textContent = `${newData.details.title} (#${newData.details.number})`;
      detailsElement.classList.remove("hidden");

      // Enhanced debugging for issue linkage
      console.log('PR data loaded:', {
        hasPRBody: !!newData.details.body,
        hasLinkedIssue: !!newData.linkedIssue,
        linkedIssueNumber: newData.linkedIssue?.number,
        type: newData.type,
        owner: newData.details.user?.login,
        detailsNumber: newData.details.number
      });

      // Log full linked issue data if present
      if (newData.linkedIssue) {
        console.log('LINKED ISSUE DETAILS:', {
          number: newData.linkedIssue.number,
          title: newData.linkedIssue.title,
          bodyExcerpt: newData.linkedIssue.body?.substring(0, 50) + '...',
          hasComments: !!newData.linkedIssue.comments && newData.linkedIssue.comments.length > 0,
          commentCount: newData.linkedIssue.comments?.length || 0
        });
      }

      // Handle bidirectional PR-Issue linking in the UI
      if (newData.type === "pr") {
        if (newData.linkedIssue) {
          // PR with a linked issue - show the issue specification at the top
          console.log('Displaying linked issue:', newData.linkedIssue.number);
          const existingIssueSpec = document.querySelector(".linked-issue-spec");
          if (!existingIssueSpec) {
            const issueSpecDiv = document.createElement("div");
            issueSpecDiv.className = "linked-issue-spec";
            issueSpecDiv.innerHTML = `
              <div class="issue-header">
                <h3>📋 Linked Issue: #${newData.linkedIssue.number}</h3>
                <a href="${newData.linkedIssue.html_url}" target="_blank" rel="noopener noreferrer">
                  ${newData.linkedIssue.title}
                </a>
              </div>
              <div class="issue-body markdown">
                ${window.marked.parse(newData.linkedIssue.body || 'No description provided.')}
              </div>
            `;
            conversation.insertBefore(issueSpecDiv, conversation.firstChild);
          }
        } else {
          // PR without linked issues
          console.log('PR does not have linked issues');
          const diagnosticInfo = document.createElement("div");
          diagnosticInfo.className = "comment"
          diagnosticInfo.innerHTML = `
            <details>
              <summary>No linked issues found. Click for troubleshooting info.</summary>
              <p>This PR doesn't have any linked issues detected. Possible reasons:</p>
              <ul>
                <li>There are no issues linked to this PR on GitHub</li>
                <li>The GitHub token might not have sufficient permissions</li>
                <li>The PR description doesn't use keywords like "Fixes #123" or "Closes #123"</li>
              </ul>
              <p>Try refreshing the page or using a different GitHub token with higher permissions.</p>
            </details>
          `;
          conversation.insertBefore(diagnosticInfo, conversation.firstChild);
        }
      } else if (newData.type === "issue") {
        // When viewing an issue, show linked PRs if any exist
        if (newData.linkedPullRequests && newData.linkedPullRequests.length > 0) {
          console.log(`Displaying ${newData.linkedPullRequests.length} linked PRs for issue #${newData.details.number}`);

          const existingPRList = document.querySelector(".linked-prs-list");
          if (!existingPRList) {
            const prListDiv = document.createElement("div");
            prListDiv.className = "linked-prs-list";

            // Create header section
            let prListHTML = `
              <div class="prs-header">
                <h3>🔗 Pull Requests referencing this Issue</h3>
                <div class="pr-count">${newData.linkedPullRequests.length} linked PR${newData.linkedPullRequests.length !== 1 ? 's' : ''}</div>
              </div>
              <ul class="prs-list">
            `;

            // Add each PR to the list
            newData.linkedPullRequests.forEach(pr => {
              // Determine status icon based on PR state
              let statusIcon = '⏳'; // Default for open
              let statusClass = 'state-open';

              if (pr.state === 'closed') {
                statusIcon = '❌';
                statusClass = 'state-closed';
              } else if (pr.state === 'merged') {
                statusIcon = '✅';
                statusClass = 'state-merged';
              }

              prListHTML += `
                <li class="pr-item ${statusClass}">
                  <span class="pr-status">${statusIcon}</span>
                  <a href="${pr.url}" target="_blank" class="pr-link">
                    #${pr.number}: ${pr.title}
                  </a>
                  <span class="pr-author">by ${pr.author.login}</span>
                </li>
              `;
            });

            prListHTML += `</ul>`;
            prListDiv.innerHTML = prListHTML;

            // Add to the DOM before the conversation
            conversation.insertBefore(prListDiv, conversation.firstChild);
          }
        } else {
          console.log('Issue does not have linked PRs');
        }
      }

      // Add the initial comment if it doesn't exist
      if (newData.details.body) {
        const existingBody = document.querySelector(".initial-comment");
        if (!existingBody) {
          const div = document.createElement("div");
          div.className = "comment initial-comment";
          div.innerHTML = `
            <div class="comment-header">
              <div class="user-info">
                <img src="${newData.details.user.avatar_url}" alt="${newData.details.user.login}" class="avatar" />
                <a href="${newData.details.user.html_url}" class="username">${newData.details.user.login}</a>
              </div>
              <div class="timestamp">
                ${new Date(newData.details.created_at).toLocaleString()}
              </div>
            </div>
            <div class="comment-body markdown">
              ${window.marked.parse(newData.details.body)}
            </div>
          `;
          conversation.insertBefore(div, conversation.firstChild);
        }
      }

      // Process all comments - from PR and linked issue if present
      let allComments = [...newData.comments];

      // If we have a linked issue and we're looking at a PR, also include linked issue comments
      if (newData.type === "pr" && newData.linkedIssue && newData.linkedIssue.comments) {
        console.log(`Including ${newData.linkedIssue.comments.length} comments from linked issue #${newData.linkedIssue.number} (looking at PR ${owner}/${repo}#${number})`);

        // Add a visual separator between PR and issue comments
        const separator = document.createElement("div");
        separator.className = "comments-separator";
        separator.innerHTML = `<h3>Comments from linked Issue #${newData.linkedIssue.number}</h3>`;
        conversation.appendChild(separator);

        // Add the linked issue comments to the total set for processing
        allComments = [...allComments, ...newData.linkedIssue.comments];
      }

      // Process all comments together for unified scoring
      const comments = processComments(allComments);
      updateSummary(comments);

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
        const freshData = await fetchGitHubData(owner, repo, number, type, githubToken || undefined);
        const currentData = cachedData ? JSON.parse(cachedData) : undefined;
        // Cache the fresh data
        localStorage.setItem(cacheKey, JSON.stringify(freshData));
        localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
        // Update UI with fresh data only if changed
        processAndDisplayData(freshData, currentData);
      } catch (error) {
        // Only handle auth errors in background fetch
        if (error instanceof Error && error.message.includes("Authentication failed") && promptForGitHubToken()) {
          try {
            const freshData = await fetchGitHubData(owner, repo, number, type, githubToken || undefined);
            const currentData = cachedData ? JSON.parse(cachedData) : undefined;
            localStorage.setItem(cacheKey, JSON.stringify(freshData));
            localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
            processAndDisplayData(freshData, currentData);
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
      processAndDisplayData(data, undefined);

      // Start background fetch if cache is older than 5 minutes
      const cacheTimestamp = localStorage.getItem(`${cacheKey}-timestamp`);
      const FIVE_MINUTES = 5 * 60 * 1000;
      if (!cacheTimestamp || Date.now() - Number(cacheTimestamp) > FIVE_MINUTES) {
        fetchFreshData();
      }
    } else {
      // No cache, fetch data normally
      try {
        data = await fetchGitHubData(owner, repo, number, type, githubToken || undefined);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
        processAndDisplayData(data, undefined);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Authentication failed") && promptForGitHubToken()) {
          try {
            data = await fetchGitHubData(owner, repo, number, type, githubToken || undefined);
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

// Clear previous results
function clearResults(): void {
  if (conversation) conversation.innerHTML = "";
  if (title) title.textContent = "Loading...";
  if (meta) meta.textContent = "";
  // Remove existing summary if present
  const existingSummary = document.querySelector(".contributor-summary");
  if (existingSummary) {
    existingSummary.remove();
  }
}

// Display error
function showError(message: string): void {
  loadingIndicator.classList.add("hidden");
  errorMessage.classList.remove("hidden");
  errorMessage.textContent = message;
}

function processComments(comments: GitHubComment[]): ScoringMetrics {
  const scores: ScoringMetrics = {
    original: [],
    logAdjusted: [],
    exponential: [],
  };

  // Track contributor scores
  const contributors: {
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

  comments
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach((comment) => {
      if (!comment.body) return; // Skip comments without body

      const commentScores = calculateAllScores(comment.body);
      appendCommentToDOM(comment, commentScores);
      updateScoreSummary(commentScores, scores);

      // Update contributor totals
      const login = comment.user.login;
      if (!contributors[login]) {
        contributors[login] = {
          avatar: comment.user.avatar_url,
          url: comment.user.html_url,
          totalWords: 0,
          originalScore: 0,
          logAdjustedScore: 0,
          exponentialScore: 0,
          commentCount: 0,
        };
      }
      contributors[login].totalWords += commentScores.wordCount;
      contributors[login].originalScore += commentScores.original;
      contributors[login].logAdjustedScore += commentScores.logAdjusted;
      contributors[login].exponentialScore += commentScores.exponential;
      contributors[login].commentCount++;
    });

  // Update summary
  updateContributorSummary(contributors);

  return scores;
}

function appendCommentToDOM(comment: GitHubComment, scores: CommentScores): void {
  const div = document.createElement("div");
  div.className = "comment";
  div.innerHTML = `
    <div class="comment-header">
      <div class="user-info">
        <img src="${comment.user.avatar_url}" alt="${comment.user.login}" class="avatar" />
        <a href="${comment.user.html_url}" class="username">${comment.user.login}</a>
      </div>
      <div class="timestamp">
        ${new Date(comment.created_at).toLocaleString()}
      </div>
    </div>
    <div class="comment-body markdown">
      ${window.marked.parse(comment.body)}
    </div>
    <div class="score-info">
      <div>Words: ${scores.wordCount}</div>
      <div>Original Score: ${scores.original.toFixed(2)}</div>
      <div>Log-Adjusted Score: ${scores.logAdjusted.toFixed(2)}</div>
      <div>Exponential Score: ${scores.exponential.toFixed(2)}</div>
    </div>
  `;
  conversation.appendChild(div);
}

function updateSummary(scores: ScoringMetrics): void {
  const totalComments = scores.original.length;
  if (totalComments === 0) {
    return;
  }

  const totalWords = scores.original.reduce((sum, _, idx) => {
    const commentElement = document.querySelectorAll(".comment")[idx];
    if (!commentElement) return sum;

    const text = commentElement.querySelector(".score-info")?.textContent || "";
    const wordMatch = text.match(/Words: (\d+)/);
    return sum + (wordMatch ? parseInt(wordMatch[1], 10) : 0);
  }, 0);

  const avgOriginal = scores.original.reduce((a, b) => a + b, 0) / totalComments;
  const avgLog = scores.logAdjusted.reduce((a, b) => a + b, 0) / totalComments;
  const avgExp = scores.exponential.reduce((a, b) => a + b, 0) / totalComments;


}

function updateScoreSummary(commentScores: CommentScores, summary: ScoringMetrics): void {
  summary.original.push(commentScores.original);
  summary.logAdjusted.push(commentScores.logAdjusted);
  summary.exponential.push(commentScores.exponential);
}

function updateContributorSummary(contributors: {
  [key: string]: {
    avatar: string;
    url: string;
    totalWords: number;
    originalScore: number;
    logAdjustedScore: number;
    exponentialScore: number;
    commentCount: number;
  };
}): void {
  // Remove any existing summary before creating a new one
  const existingSummary = document.querySelector(".contributor-summary");
  if (existingSummary) {
    existingSummary.remove();
  }

  const summaryContainer = document.createElement("div");
  summaryContainer.className = "contributor-summary";
  summaryContainer.innerHTML = "<h3>Contributor Summary</h3>";

  const sortedContributors = Object.entries(contributors).sort(
    ([, a], [, b]) => b.exponentialScore - a.exponentialScore
  );

  const summaryList = document.createElement("div");
  summaryList.className = "contributor-list";

  sortedContributors.forEach(([login, stats]) => {
    const contributorEl = document.createElement("div");
    contributorEl.className = "contributor-item";
    contributorEl.innerHTML = `
      <div class="user-info">
        <img src="${stats.avatar}" alt="${login}" class="avatar" />
        <a href="${stats.url}" class="username">${login}</a>
      </div>
      <div class="contributor-stats">
        <div class="stat">
          <span class="stat-label">Comments:</span>
          <span class="stat-value">${stats.commentCount}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Total Words:</span>
          <span class="stat-value">${stats.totalWords}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Exp Score:</span>
          <span class="stat-value">${stats.exponentialScore.toFixed(2)}</span>
        </div>
      </div>
    `;
    summaryList.appendChild(contributorEl);
  });

  summaryContainer.appendChild(summaryList);

  // Place summary before the conversation
  const conversation = document.getElementById("conversation");
  if (conversation) {
    conversation.insertAdjacentElement("beforebegin", summaryContainer);
  }
}
