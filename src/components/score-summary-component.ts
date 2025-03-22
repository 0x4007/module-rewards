/**
 * Score Summary Component - Aggregates and displays contributor scores
 * Restores the functionality to show total scores for each contributor
 */
import { domManager } from "../dom-manager";
import { CommentScores, GitHubComment, GitHubUser } from "../types";

interface ContributorScores {
  user: GitHubUser;
  totalOriginal: number;
  totalLogAdjusted: number;
  totalExponential: number;
  commentCount: number;
}

/**
 * Aggregates scores by contributor across all comments
 */
export function aggregateScoresByContributor(
  prComments: GitHubComment[],
  issueComments: GitHubComment[],
  scoreMap: Map<number, CommentScores>
): ContributorScores[] {
  // Combine all comments
  const allComments = [...prComments, ...issueComments];

  // Map to track contributors and their scores
  const contributorsMap = new Map<string, ContributorScores>();

  // Process each comment
  allComments.forEach(comment => {
    // Skip comments without user info or scores
    if (!comment.user || !scoreMap.has(comment.id)) return;

    const username = comment.user.login;
    const scores = scoreMap.get(comment.id)!;

    // Get or create contributor entry
    if (!contributorsMap.has(username)) {
      contributorsMap.set(username, {
        user: comment.user,
        totalOriginal: 0,
        totalLogAdjusted: 0,
        totalExponential: 0,
        commentCount: 0
      });
    }

    // Update contributor totals
    const contributor = contributorsMap.get(username)!;
    contributor.totalOriginal += scores.original;
    contributor.totalLogAdjusted += scores.logAdjusted;
    contributor.totalExponential += scores.exponential;
    contributor.commentCount++;
  });

  // Convert map to array and sort by highest exponential score
  return Array.from(contributorsMap.values())
    .sort((a, b) => b.totalExponential - a.totalExponential);
}

/**
 * Renders the score summary at the top of the page
 */
export function renderScoreSummary(
  prComments: GitHubComment[],
  issueComments: GitHubComment[],
  scoreMap: Map<number, CommentScores>
): void {
  // Aggregate scores by contributor
  const contributorScores = aggregateScoresByContributor(
    prComments,
    issueComments,
    scoreMap
  );

  // Don't show empty summary
  if (contributorScores.length === 0) {
    domManager.hide("scoreSummary");
    return;
  }

  // Clear previous content
  domManager.withElement("scoreSummaryContent", (element) => {
    element.innerHTML = "";

    // Create table to display scores
    const table = document.createElement("table");
    table.className = "score-summary-table";

    // Create header row
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `
      <th class="contributor-col">Contributor</th>
      <th class="score-col">Original</th>
      <th class="score-col">Log-Adjusted</th>
      <th class="score-col sort-column">Exponential</th>
      <th class="score-col">Comments</th>
    `;
    table.appendChild(headerRow);

    // Add row for each contributor
    contributorScores.forEach(contributor => {
      const row = document.createElement("tr");

      // Contributor cell with avatar and name
      const contributorCell = document.createElement("td");
      contributorCell.className = "contributor-cell";

      // Add avatar if available
      if (contributor.user.avatar_url) {
        const avatar = document.createElement("img");
        avatar.src = contributor.user.avatar_url;
        avatar.alt = contributor.user.login;
        avatar.className = "summary-avatar";
        contributorCell.appendChild(avatar);
      }

      // Add username
      const username = document.createElement("a");
      username.href = contributor.user.html_url;
      username.textContent = contributor.user.login;
      username.className = "summary-username";
      contributorCell.appendChild(username);

      row.appendChild(contributorCell);

      // Score cells
      const originalCell = document.createElement("td");
      originalCell.textContent = contributor.totalOriginal.toFixed(2);
      row.appendChild(originalCell);

      const logAdjustedCell = document.createElement("td");
      logAdjustedCell.textContent = contributor.totalLogAdjusted.toFixed(2);
      row.appendChild(logAdjustedCell);

      const exponentialCell = document.createElement("td");
      exponentialCell.className = "sort-column-cell";
      exponentialCell.textContent = contributor.totalExponential.toFixed(2);
      row.appendChild(exponentialCell);

      const commentCountCell = document.createElement("td");
      commentCountCell.textContent = contributor.commentCount.toString();
      row.appendChild(commentCountCell);

      table.appendChild(row);
    });

    element.appendChild(table);
  });

  // Show the summary
  domManager.show("scoreSummary");
}

/**
 * Clear the score summary
 */
export function clearScoreSummary(): void {
  domManager.clearContent("scoreSummaryContent");
  domManager.hide("scoreSummary");
}
