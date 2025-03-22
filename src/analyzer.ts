import { appendCommentToDOM, clearResults, showError } from "./dom-utils";
import { GitHubClient } from "./github";
import { FetchedData } from "./github/types";
import { calculateAllScores } from "./scoring-utils";
import { GitHubComment } from "./types";
import { uiStateManager } from "./ui-state-manager";

// Get DOM elements directly rather than importing from main.ts
const loadingIndicator = document.getElementById("loading-indicator") as HTMLElement;
const detailsElement = document.getElementById("details") as HTMLElement;
const title = document.querySelector("#details .title") as HTMLElement;
const meta = document.querySelector("#details .meta") as HTMLElement;
const issueConversation = document.getElementById("issue-conversation") as HTMLElement;
const prConversation = document.getElementById("pr-conversation") as HTMLElement;

// Cache management
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const githubClient = new GitHubClient(localStorage.getItem("github_token") || undefined);

/**
 * Process and display content for a GitHub issue or PR
 */
export async function analyze(inputUrl: string): Promise<void> {
  if (!inputUrl || !inputUrl.includes("github.com")) {
    showError("Please enter a valid GitHub URL");
    return;
  }

  // Show global loading state
  loadingIndicator.classList.remove("hidden");

  // Initialize UI state manager with containers
  uiStateManager.registerContainer("issue", issueConversation);
  uiStateManager.registerContainer("pr", prConversation);

  // Clear previous content
  clearResults("#details");
  uiStateManager.clearSection("issue");
  uiStateManager.clearSection("pr");

  // Start loading state for both sections
  uiStateManager.startLoading("issue");
  uiStateManager.startLoading("pr");

  try {
    // Parse the URL and set up cache key
    const parsedUrl = githubClient.parseUrl(inputUrl);
    const { owner, repo, number, type } = parsedUrl;
    const cacheKey = `data-${owner}-${repo}-${type}-${number}`;
    const cachedTimestampKey = `${cacheKey}-timestamp`;

    let data: FetchedData | null = null;

    // Check cache first
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTimestamp = localStorage.getItem(cachedTimestampKey);
    const cacheExpired = !cachedTimestamp || (Date.now() - parseInt(cachedTimestamp)) > CACHE_EXPIRY;

    // Use cached data if available and fresh
    if (cachedData && !cacheExpired) {
      data = JSON.parse(cachedData);
      if (data) {
        processData(data);
      }
    }

    // Always fetch fresh data (either immediately or in background)
    try {
      const freshData = await githubClient.fetchData(owner, repo, number, type);

      // Cache the fresh data
      localStorage.setItem(cacheKey, JSON.stringify(freshData));
      localStorage.setItem(cachedTimestampKey, Date.now().toString());

      // If we didn't have cached data, process the fresh data
      if (!data) {
        processData(freshData);
      } else if (hasContentChanged(data, freshData)) {
        // If content changed, update the display
        processData(freshData);
        notifyContentUpdated();
      }
    } catch (error) {
      // Only show error if we don't have any data
      if (!data) {
        throw error;
      }

      // Otherwise log but don't interrupt the user
      console.error("Background fetch failed:", error);
    }
  } catch (error) {
    uiStateManager.setError("issue", error instanceof Error ? error.message : String(error));
    uiStateManager.setError("pr", error instanceof Error ? error.message : String(error));
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    loadingIndicator.classList.add("hidden");
  }
}

/**
 * Process and display GitHub data
 */
function processData(data: FetchedData): void {
  // Show essential information
  detailsElement.classList.remove("hidden");
  title.textContent = `${data.details.title} (#${data.details.number})`;

  // Process different content based on type
  if (data.type === "pr") {
    processPRView(data);
  } else {
    processIssueView(data);
  }
}

/**
 * Process and display PR view with linked issues
 */
function processPRView(data: FetchedData): void {
  const prComments: GitHubComment[] = [...data.comments];
  const issueComments: GitHubComment[] = [];

  // Add PR body as first comment
  if (data.details.body) {
    const prBodyComment: GitHubComment = {
      id: 0,
      body: data.details.body,
      user: data.details.user,
      created_at: data.details.created_at,
      updated_at: data.details.updated_at,
      html_url: data.details.html_url,
    };
    // Insert at beginning
    prComments.unshift(prBodyComment);
  }

  // Add PR label to meta
  meta.innerHTML += ` <span class="meta-separator">|</span> <strong>Viewing PR #${data.details.number}</strong>`;

  // Handle linked issue if available
  if (data.linkedIssue) {
    // Add a heading for the linked issue
    const issueHeader = document.createElement("div");
    issueHeader.className = "linked-content-header";
    issueHeader.innerHTML = `<h3>Linked Issue #${data.linkedIssue.number}: ${data.linkedIssue.title}</h3>`;
    issueConversation.appendChild(issueHeader);

    // First add the issue body as a comment
    if (data.linkedIssue.body) {
      const issueBodyComment: GitHubComment = {
        id: -1,
        body: data.linkedIssue.body,
        user: { login: "unknown", html_url: "", avatar_url: "" },
        created_at: "",
        updated_at: "",
        html_url: data.linkedIssue.html_url,
      };
      issueComments.push(issueBodyComment);
    }

    // Then add all issue comments if available
    if (data.linkedIssue.comments) {
      issueComments.push(...data.linkedIssue.comments);
    }
  }

  // Process and display the content
  displayComments("pr", prComments);
  displayComments("issue", issueComments);
}

/**
 * Process and display Issue view with linked PRs
 */
function processIssueView(data: FetchedData): void {
  const issueComments: GitHubComment[] = [...data.comments];
  const prComments: GitHubComment[] = [];

  // Add issue body as first comment
  if (data.details.body) {
    const issueBodyComment: GitHubComment = {
      id: 0,
      body: data.details.body,
      user: data.details.user,
      created_at: data.details.created_at,
      updated_at: data.details.updated_at,
      html_url: data.details.html_url,
    };
    // Insert at beginning
    issueComments.unshift(issueBodyComment);
  }

  // Handle linked PRs if available
  if (data.linkedPullRequests && data.linkedPullRequests.length > 0) {
    const mainPR = data.linkedPullRequests[0];

    // Add a heading for the linked PR
    const prHeader = document.createElement("div");
    prHeader.className = "linked-content-header";
    prHeader.innerHTML = `<h3>Linked PR #${mainPR.number}: ${mainPR.title}</h3>`;
    prConversation.appendChild(prHeader);

    // If we have the PR body, add it as first comment
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

    // Add PR comments if available
    if (mainPR.comments) {
      prComments.push(...mainPR.comments);
    } else {
      // If no comments, just show PR references
      const prListHTML = generatePRListHTML(data.linkedPullRequests);
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

  // Process and display the content
  displayComments("issue", issueComments);
  displayComments("pr", prComments);
}

/**
 * Display comments with scores in the appropriate container
 */
function displayComments(section: "pr" | "issue", comments: GitHubComment[]): void {
  // Get the container based on section
  const container = section === "pr" ? prConversation : issueConversation;

  // If no comments, set content loaded with hasContent=false
  if (comments.length === 0) {
    uiStateManager.setContentLoaded(section, false);
    return;
  }

  // Sort comments - ensure PR/issue body (with special IDs like 0, -3) always comes first,
  // then sort remaining comments by creation date
  const sortedComments = [...comments].sort((a, b) => {
    // Special IDs for PR/issue body comments
    const bodyCommentIds = [0, -3];

    // If a is a body comment and b is not, a comes first
    if (bodyCommentIds.includes(a.id) && !bodyCommentIds.includes(b.id)) {
      return -1;
    }

    // If b is a body comment and a is not, b comes first
    if (bodyCommentIds.includes(b.id) && !bodyCommentIds.includes(a.id)) {
      return 1;
    }

    // Otherwise sort by creation date
    return new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime();
  });

  // Calculate scores and render each comment
  for (const comment of sortedComments) {
    if (!comment.body) continue;

    // Calculate scores for this comment
    const commentScores = calculateAllScores(comment.body);

    // Add score data to the container's dataset
    const scoreData = {
      wordCount: commentScores.wordCount,
      original: commentScores.original,
      logAdjusted: commentScores.logAdjusted,
      exponential: commentScores.exponential
    };

    // Render comment with score metadata
    const containerSelector = `#${section}-conversation`;
    appendCommentToDOM(comment, {
      containerSelector,
      className: "comment"
    });

    // Add score display below the comment
    const container = document.querySelector(containerSelector);
    const commentEl = container?.lastElementChild as HTMLElement;

    if (commentEl) {
      const scoreDiv = document.createElement("div");
      scoreDiv.className = "comment-scores";
      scoreDiv.innerHTML = `
        <div class="score-info">
          <span class="score-label">Words:</span>
          <span class="score-value">${commentScores.wordCount}</span>
        </div>
        <div class="score-info">
          <span class="score-label">Original Score:</span>
          <span class="score-value">${commentScores.original.toFixed(2)}</span>
        </div>
        <div class="score-info">
          <span class="score-label">Log-Adjusted:</span>
          <span class="score-value">${commentScores.logAdjusted.toFixed(2)}</span>
        </div>
        <div class="score-info">
          <span class="score-label">Exponential:</span>
          <span class="score-value">${commentScores.exponential.toFixed(2)}</span>
        </div>
      `;

      // Add the scores to the comment
      commentEl.appendChild(scoreDiv);
    }
  }

  // Mark this section as having content
  uiStateManager.setContentLoaded(section, true);
}

/**
 * Generate HTML for PR list
 */
function generatePRListHTML(prs: any[]): string {
  let html = `# Linked Pull Requests\n\n`;

  prs.forEach((pr) => {
    const statusIcon = pr.state === "closed" ? "❌" : pr.state === "merged" ? "✅" : "⏳";
    html += `${statusIcon} [#${pr.number}: ${pr.title}](${pr.url}) by ${pr.author.login}\n\n`;
  });

  return html;
}

/**
 * Check if content has meaningfully changed between data fetches
 */
function hasContentChanged(oldData: FetchedData, newData: FetchedData): boolean {
  // Compare basic properties
  if (oldData.details.title !== newData.details.title ||
      oldData.details.body !== newData.details.body) {
    return true;
  }

  // Compare comment counts
  if (oldData.comments.length !== newData.comments.length) {
    return true;
  }

  // Could add more sophisticated comparison here
  return false;
}

/**
 * Show a notification when content is updated
 */
function notifyContentUpdated(): void {
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
