/**
 * Data Processor - Processes GitHub API data into display-ready format
 */
import { GitHubComment } from "../types";
import { FetchedData, LinkedPullRequest } from "./github-api-service";

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
  // Detect environment consistently across the application
  const inProduction = typeof window !== 'undefined' &&
                      window.location.hostname !== "localhost" &&
                      window.location.hostname !== "127.0.0.1";
  const envPrefix = inProduction ? '[PROD]' : '[DEV]';

  console.log(`${envPrefix} Processing GitHub data, type: ${data.type}`);

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
      console.log(`${envPrefix} Set PR info: ${prInfo}`);
    } else {
      console.log(`${envPrefix} No linked PRs found for issue #${data.details.number}`);
    }
  }

  console.log(`${envPrefix} Processed ${prComments.length} PR comments and ${issueComments.length} issue comments`);
  return { prComments, issueComments, prInfo, issueInfo };
}

/**
 * Process and prepare PR data for display
 */
function processPRView(data: FetchedData, prComments: GitHubComment[], issueComments: GitHubComment[]): void {
  // Create temporary array to hold all comments
  const allComments: GitHubComment[] = [];

  // Add all PR comments first (this will be chronological)
  if (data.comments && data.comments.length > 0) {
    allComments.push(...data.comments);
  }

  // Add PR body as the very first comment if it exists
  if (data.details.body) {
    const prBodyComment: GitHubComment = {
      id: 0,
      body: data.details.body,
      user: data.details.user,
      created_at: data.details.created_at,
      updated_at: data.details.updated_at,
      html_url: data.details.html_url
    };
    // Properly insert at the beginning to prevent double-post issues
    allComments.unshift(prBodyComment);
  }

  // Now assign the properly ordered comments
  prComments.push(...allComments);

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
        html_url: data.linkedIssue.html_url
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
  // Detect environment consistently across the application
  const inProduction = typeof window !== 'undefined' &&
                      window.location.hostname !== "localhost" &&
                      window.location.hostname !== "127.0.0.1";
  const envPrefix = inProduction ? '[PROD]' : '[DEV]';

  console.log(`${envPrefix} Processing issue view for #${data.details.number}`);

  // Create temporary array to hold all comments
  const allComments: GitHubComment[] = [];

  // Add all issue comments first (this will be chronological)
  if (data.comments && data.comments.length > 0) {
    allComments.push(...data.comments);
  }

  // Add issue body as the very first comment if it exists
  if (data.details.body) {
    const issueBodyComment: GitHubComment = {
      id: 0,
      body: data.details.body,
      user: data.details.user,
      created_at: data.details.created_at,
      updated_at: data.details.updated_at,
      html_url: data.details.html_url
    };
    // Properly insert at the beginning to prevent double-post issues
    allComments.unshift(issueBodyComment);
  }

  // Now assign the properly ordered comments
  issueComments.push(...allComments);

  // Handle linked PRs if available
  console.log(`${envPrefix} Checking linked PRs, data.linkedPullRequests:`,
    data.linkedPullRequests ? `Found ${data.linkedPullRequests.length} PRs` : 'None found');

  if (data.linkedPullRequests && data.linkedPullRequests.length > 0) {
    console.log(`${envPrefix} Linked PRs available:`,
      data.linkedPullRequests.map(pr => `#${pr.number} (${pr.state})`).join(', '));

    const mainPR = data.linkedPullRequests[0];
    console.log(`${envPrefix} Processing main linked PR #${mainPR.number}`);

    // If we have the PR body, add it as first comment
    // Create temporary array to hold all comments
    const prAllComments: GitHubComment[] = [];

    // Add PR comments if available first (chronological order)
    if (mainPR.comments) {
      console.log(`${envPrefix} Adding ${mainPR.comments.length} PR comments`);
      prAllComments.push(...mainPR.comments);
    }

    // Add PR body as the very first comment if it exists
    if (mainPR.body) {
      console.log(`${envPrefix} Adding PR body as first comment`);
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
        html_url: mainPR.url
      };
      // Properly insert at the beginning to prevent double-post issues
      prAllComments.unshift(prBodyComment);
    } else {
      console.log(`${envPrefix} PR #${mainPR.number} has no body content`);
    }

    // Now assign the properly ordered comments if we have any
    if (prAllComments.length > 0) {
      prComments.push(...prAllComments);
    } else {
      console.log(`${envPrefix} No comments found for PR #${mainPR.number}, generating PR list HTML instead`);
      // If no comments, just show PR references
      const prListHTML = generatePRListHTML(data.linkedPullRequests);
      const prListComment: GitHubComment = {
        id: -2,
        body: prListHTML,
        user: {
          login: "GitHub References",
          html_url: "",
          avatar_url: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        html_url: ""
      };
      prComments.push(prListComment);
    }
  } else {
    console.log(`${envPrefix} No linked PRs found for issue #${data.details.number}`);
  }

  console.log(`${envPrefix} Finished processing issue view, PR comments count: ${prComments.length}`);
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
  document.body.appendChild(notification);

  // Fade in
  setTimeout(() => (notification.style.opacity = "1"), 0);

  // Fade out and remove after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
