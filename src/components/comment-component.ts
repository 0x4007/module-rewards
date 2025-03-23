/**
 * Comment Component - Handles rendering of GitHub comments
 * Includes functionality for displaying comment content, user info, and scores
 */
import { detectConsecutiveComments } from "../comment-grouping";
import { calculateGroupAwareScores } from "../scoring-utils";
import { CommentScores, GitHubComment } from "../types";

// Export the scoreMap for use by other components
export const scoreMap = new Map<number, CommentScores>();

interface CommentDisplayOptions {
  containerSelector: string;
  idPrefix?: string;
  className?: string;
  showScores?: boolean;
}

/**
 * Check if a user is a GitHub bot account
 */
export function isGitHubBot(user?: any): boolean {
  if (!user) return false;

  // Check if user has the .type property set to 'Bot'
  if (user.type === "Bot") return true;

  // Check for common bot username patterns
  return user.login.endsWith("[bot]") ||
    ["github-actions", "dependabot", "renovate"].some(botName =>
      user.login.toLowerCase().includes(botName.toLowerCase())
    );
}

/**
 * Render a GitHub comment to the DOM
 */
function renderComment(
  comment: GitHubComment,
  options: CommentDisplayOptions,
  scores?: CommentScores
): HTMLElement | null {
  const { containerSelector, idPrefix = "comment", className = "comment", showScores = true } = options;
  const container = document.querySelector(containerSelector);

  if (!container) {
    console.error(`Container not found: ${containerSelector}`);
    return null;
  }

  // Create the comment container
  const commentElement = document.createElement("div");
  commentElement.id = `${idPrefix}-${comment.id}`;
  commentElement.className = className;

  // Add special class if this is part of a group
  if (scores?.isGrouped) {
    commentElement.classList.add("grouped-comment", "badge-base");
  }

  // Add special class for GitHub References comments
  if (comment.user?.login === "GitHub References") {
    commentElement.classList.add("system-reference-comment");
  }

  // Create header with avatar and user info if available
  if (comment.user) {
    const headerElement = document.createElement("div");
    headerElement.className = "comment-header";

    // Add avatar if available
    if (comment.user.avatar_url) {
      const avatarElement = document.createElement("img");
      avatarElement.className = "avatar";
      avatarElement.src = comment.user.avatar_url;
      avatarElement.alt = comment.user.login;
      headerElement.appendChild(avatarElement);
    }

    // Add user info and timestamp
    const userInfoElement = document.createElement("div");
    userInfoElement.className = "user-info";

    const usernameElement = document.createElement("a");
    usernameElement.href = comment.user.html_url || "#";
    usernameElement.className = "username";
    usernameElement.textContent = comment.user.login;
    userInfoElement.appendChild(usernameElement);

    if (comment.created_at) {
      const timestampElement = document.createElement("a");
      timestampElement.className = "timestamp";
      // Ensure we link directly to the comment by adding the comment ID as a fragment
      const commentUrl = comment.html_url || `${comment.user.html_url}#issuecomment-${comment.id}`;
      timestampElement.href = commentUrl;
      timestampElement.target = "_blank";
      timestampElement.rel = "noopener noreferrer";
      const dateObject = new Date(comment.created_at);
      timestampElement.textContent = dateObject.toLocaleString();
      userInfoElement.appendChild(timestampElement);
    }

    headerElement.appendChild(userInfoElement);
    commentElement.appendChild(headerElement);
  }

  // Create comment body with markdown rendering
  const bodyElement = document.createElement("div");
  bodyElement.className = "comment-body";

  // Use marked to render markdown if available
  try {
    if (window.marked) {
      bodyElement.innerHTML = window.marked.parse(comment.body);
    } else {
      bodyElement.innerHTML = comment.body;
    }
  } catch (e) {
    console.error("Error rendering markdown:", e);
    bodyElement.innerHTML = comment.body;
  }

  commentElement.appendChild(bodyElement);

  // Add scores if provided and showScores is true
  if (scores && showScores) {
    // Add special classes for identified comment types
    if (scores.wordCount === 0) {
      // Add slash command styling
      if (comment.body.trim().startsWith("/")) {
        commentElement.classList.add("slash-command", "badge-base");
      }

      // Add bot comment styling (check for bot indicators in username)
      if (isGitHubBot(comment.user)) {
        commentElement.classList.add("bot-comment", "badge-base");
      }
    }

    const scoresElement = renderScores(scores);
    commentElement.appendChild(scoresElement);
  }

  // Add the comment to the container
  container.appendChild(commentElement);

  return commentElement;
}

/**
 * Render scores for a comment
 */
function renderScores(scores: CommentScores): HTMLElement {
  const scoreDivOuter = document.createElement("div");
  scoreDivOuter.className = "comment-scores-outer";
  const scoreDivInner = document.createElement("div");
  scoreDivInner.className = "comment-scores-inner";

  // Start with basic scores
  let scoreHtml = `
    <div class="score-info">
      <span class="score-label">Words:</span>
      <span class="score-value">${scores.wordCount}</span>
    </div>
    <div class="score-info">
      <span class="score-label">Original Score:</span>
      <span class="score-value">${scores.original.toFixed(2)}</span>
    </div>
    <div class="score-info">
      <span class="score-label">Exponential:</span>
      <span class="score-value">${scores.exponential.toFixed(2)}</span>
    </div>
  `;

  // If this comment is part of a group, add group information
  if (scores.isGrouped && scores.groupWordCount) {
    scoreHtml += `
      <div class="score-info group-info">
        <span class="score-label">Group Words:</span>
        <span class="score-value">${scores.groupWordCount}</span>
        <span class="group-indicator" title="This comment is part of a sequence of consecutive comments by the same user in the same context (PR conversation, PR review, or issue). All comments in the sequence are scored as if they were a single comment to prevent gaming the system with multiple short comments.">⚠️</span>
      </div>
    `;
  }

  scoreDivInner.innerHTML = scoreHtml;
  scoreDivOuter.appendChild(scoreDivInner);
  return scoreDivOuter;
}

/**
 * Render a list of comments
 */
export function renderComments(
  section: "pr" | "issue",
  comments: GitHubComment[],
  containerSelector: string,
  titleInfo?: { title: string; number: string }
): void {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.error(`Container not found: ${containerSelector}`);
    return;
  }

  // If no comments, show empty state with icon
  if (comments.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    const icon =
      section === "issue"
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path></svg>';
    emptyState.innerHTML = `${icon} No ${section === "issue" ? "issue" : "pull request"} comments yet`;
    container.appendChild(emptyState);
    return;
  }

  // Add section header with icon
  const headerElement = document.createElement("div");
  headerElement.className = "conversation-header";
  const icon =
    section === "issue"
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path></svg>';

  // Include title and number if provided
  let headerContent = "";
  if (titleInfo && titleInfo.title) {
    headerContent = `${icon} <h6>${titleInfo.title}</h6>`;
  } else {
    headerContent = `${icon} Conversation`;
  }

  headerElement.innerHTML = headerContent;
  container.appendChild(headerElement);

  // Sort comments - ensure PR/issue body (with special IDs like 0, -3) always comes first,
  // then sort remaining comments by creation date
  const sortedComments = [...comments].sort((a, b) => {
    // Special IDs for PR/issue body comments
    const bodyCommentIds = [0, -3];

    // If a is a body comment and b is not, a comes first
    if (bodyCommentIds.includes(a.id as number) && !bodyCommentIds.includes(b.id as number)) {
      return -1;
    }

    // If b is a body comment and a is not, b comes first
    if (bodyCommentIds.includes(b.id as number) && !bodyCommentIds.includes(a.id as number)) {
      return 1;
    }

    // Otherwise sort by creation date
    return new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime();
  });

  // Detect consecutive comments from the same user within the same context
  const commentGroups = detectConsecutiveComments(sortedComments, section);

  // Only clear scores when we're processing PR comments (the first set)
  if (section === "pr") {
    scoreMap.clear();
  }

  // Render each comment
  for (const comment of sortedComments) {
    if (!comment.body) continue;

    // Check if this comment is part of a group
    const groupInfo = commentGroups[String(comment.id)];
    let showScores = true;
    let commentScores: CommentScores | undefined;

    if (groupInfo) {
      // Only show scores on the last comment in each group
      const isLastInGroup = groupInfo.commentIds[groupInfo.commentIds.length - 1] === comment.id;
      showScores = isLastInGroup;

      if (isLastInGroup) {
        // For the last comment, calculate scores based on the entire group
        commentScores = calculateGroupAwareScores(comment.body, comment.id, commentGroups);

        // Store scores in the map
        if (commentScores) {
          scoreMap.set(comment.id, commentScores);
        }
      }
    } else {
      // For comments not in a group, calculate scores normally
      // Check for special comment types
      const isSlashCommand = comment.body.trim().startsWith("/");
      const isBot = isGitHubBot(comment.user);
      commentScores = calculateGroupAwareScores(comment.body, comment.id, commentGroups, isSlashCommand, isBot);

      // Store scores in the map
      if (commentScores) {
        scoreMap.set(comment.id, commentScores);
      }
    }

    // Render the comment
    renderComment(
      comment,
      {
        containerSelector,
        className: "comment",
        showScores,
      },
      commentScores
    );
  }
}
