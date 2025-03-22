import { GitHubComment, CommentScores } from "./types";

// Append comment to DOM in the specified column
export function appendCommentToDOM(comment: GitHubComment, scores: CommentScores, container: HTMLElement): void {
  const div = document.createElement("div");
  div.className = "comment";

  // Generate user info section if available
  let userInfoHTML = '';
  if (comment.user && comment.user.login) {
    userInfoHTML = `
      <div class="user-info">
        ${comment.user.avatar_url ? `<img src="${comment.user.avatar_url}" alt="${comment.user.login}" class="avatar" />` : ''}
        ${comment.user.html_url ? `<a href="${comment.user.html_url}" class="username">${comment.user.login}</a>` : comment.user.login}
      </div>
    `;
  } else {
    userInfoHTML = `<div class="user-info">Unknown User</div>`;
  }

  // Generate timestamp if available
  let timestampHTML = '';
  if (comment.created_at) {
    timestampHTML = `
      <div class="timestamp">
        ${new Date(comment.created_at).toLocaleString()}
      </div>
    `;
  }

  div.innerHTML = `
    <div class="comment-header">
      ${userInfoHTML}
      ${timestampHTML}
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
  container.appendChild(div);
}
