/**
 * Data Processor - Processes GitHub data into display-ready format
 * Extracted from analyzer.ts to improve separation of concerns
 */
import { FetchedData, LinkedPullRequest } from "../github/types";
import { GitHubComment } from "../types";

/**
 * Process and prepare GitHub data for display
 * @param data Raw data from GitHub API
 * @returns Processed data ready for display
 */
export function processGitHubData(data: FetchedData): {
  prComments: GitHubComment[];
  issueComments: GitHubComment[];
  prInfo?: string;
  issueInfo?: string;
} {
  // Initialize return values
  const prComments: GitHubComment[] = [];
  const issueComments: GitHubComment[] = [];
  let prInfo: string | undefined;
  let issueInfo: string | undefined;

  // Process different content based on type
  if (data.type === "pr") {
    processPRView(data, prComments, issueComments);
    prInfo = `Viewing PR #${data.details.number}`;
    if (data.linkedIssue) {
      issueInfo = `Linked Issue #${data.linkedIssue.number}: ${data.linkedIssue.title}`;
    }
  } else {
    processIssueView(data, prComments, issueComments);
    issueInfo = `Viewing Issue #${data.details.number}`;
    if (data.linkedPullRequests && data.linkedPullRequests.length > 0) {
      const mainPR = data.linkedPullRequests[0];
      prInfo = `Linked PR #${mainPR.number}: ${mainPR.title}`;
    }
  }

  return { prComments, issueComments, prInfo, issueInfo };
}

/**
 * Process and prepare PR data for display
 */
function processPRView(data: FetchedData, prComments: GitHubComment[], issueComments: GitHubComment[]): void {
  // Add PR body as first comment if it exists
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
    prComments.push(prBodyComment);
  }

  // Add all PR comments
  if (data.comments && data.comments.length > 0) {
    prComments.push(...data.comments);
  }

  // Handle linked issue if available
  if (data.linkedIssue) {
    // Add the issue body as a comment if it exists
    if (data.linkedIssue.body) {
      const issueBodyComment: GitHubComment = {
        id: -1,
        body: data.linkedIssue.body,
        user: data.details.user, // Use PR author as fallback
        created_at: "",
        updated_at: "",
        html_url: data.linkedIssue.html_url,
      };
      issueComments.push(issueBodyComment);
    }

    // Add all issue comments if available
    if (data.linkedIssue.comments) {
      issueComments.push(...data.linkedIssue.comments);
    }
  }
}

/**
 * Process and prepare Issue data for display
 */
function processIssueView(data: FetchedData, prComments: GitHubComment[], issueComments: GitHubComment[]): void {
  // Add issue body as first comment if it exists
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
    issueComments.push(issueBodyComment);
  }

  // Add all issue comments
  if (data.comments && data.comments.length > 0) {
    issueComments.push(...data.comments);
  }

  // Handle linked PRs if available
  if (data.linkedPullRequests && data.linkedPullRequests.length > 0) {
    const mainPR = data.linkedPullRequests[0];

    // If we have the PR body, add it as first comment
    if (mainPR.body) {
      const prBodyComment: GitHubComment = {
        id: -3,
        body: mainPR.body,
        user: {
          login: mainPR.author.login,
          html_url: mainPR.author.html_url || "",
          avatar_url: mainPR.author.avatar_url || "",
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
}

/**
 * Generate HTML for PR list
 */
function generatePRListHTML(prs: LinkedPullRequest[]): string {
  let html = `# Linked Pull Requests\n\n`;

  prs.forEach((pr) => {
    const statusIcon = pr.state === "closed" ? "❌" : pr.state === "merged" ? "✅" : "⏳";
    html += `${statusIcon} [#${pr.number}: ${pr.title}](${pr.url}) by ${pr.author.login}\n\n`;
  });

  return html;
}

/**
 * Show a notification when content is updated
 */
export function notifyContentUpdated(): void {
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
