/**
 * Score Summary Component - Aggregates and displays contributor scores
 */
import { domManager } from "../dom-manager";
import { calculateUserScores } from "../scoring-utils";
import { GitHubComment } from "../types";
import { scoreMap } from "./comment-component";

/**
 * Renders the score summary at the top of the page
 */
export function renderScoreSummary(
  prComments: GitHubComment[],
  issueComments: GitHubComment[]
): void {
  // Combine all comments to calculate contributor scores
  const allComments = [...prComments, ...issueComments];

  // Don't show empty summary
  if (allComments.length === 0) {
    domManager.hide("scoreSummary");
    return;
  }

  // Calculate contributor scores
  const userScores = calculateUserScores(scoreMap, allComments);

  // Convert to array for sorting
  const contributorScores = Object.entries(userScores).map(([username, stats]) => ({
    username,
    stats
  }));

  // Sort by exponential score (highest first)
  contributorScores.sort((a, b) => b.stats.exponential - a.stats.exponential);

  // Clear previous content
  domManager.withElement("scoreSummaryContent", (element) => {
    element.innerHTML = "";

    // Create table to display scores
    const table = document.createElement("table");
    table.className = "score-summary-table";

    // Create header row
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `
      <th class="contributor-col">Contributor Score Summary</th>
      <th class="score-col">Original</th>
      <th class="score-col sort-column">Exponential</th>
      <th class="score-col">Comments</th>
    `;
    table.appendChild(headerRow);

    // Add row for each contributor
    contributorScores.forEach(({ username, stats }) => {
      const row = document.createElement("tr");

      // Contributor cell with avatar and name
      const contributorCell = document.createElement("td");
      contributorCell.className = "contributor-cell";

      // Add avatar if available
      if (stats.avatar) {
        const avatar = document.createElement("img");
        avatar.src = stats.avatar;
        avatar.alt = username;
        avatar.className = "summary-avatar";
        contributorCell.appendChild(avatar);
      }

      // Add username
      const usernameEl = document.createElement("a");
      if (stats.url) {
        usernameEl.href = stats.url;
        usernameEl.target = "_blank";
      } else {
        usernameEl.href = "#";
      }
      usernameEl.textContent = username;
      usernameEl.className = "summary-username";
      contributorCell.appendChild(usernameEl);

      row.appendChild(contributorCell);

      // Score cells
      const originalCell = document.createElement("td");
      originalCell.textContent = stats.original.toFixed(2);
      row.appendChild(originalCell);

      const exponentialCell = document.createElement("td");
      exponentialCell.className = "sort-column-cell";
      exponentialCell.textContent = stats.exponential.toFixed(2);
      row.appendChild(exponentialCell);

      const commentCountCell = document.createElement("td");
      commentCountCell.textContent = stats.count.toString();
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
