export function updateContributorSummary(contributors: {
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
  console.log("Updating contributor summary with data for", Object.keys(contributors).length, "contributors");

  // Remove any existing summary before creating a new one
  const existingSummary = document.querySelector(".contributor-summary");
  if (existingSummary) {
    console.log("Removing existing contributor summary");
    existingSummary.remove();
  }

  // Skip if no contributors
  if (Object.keys(contributors).length === 0) {
    console.log("No contributors to display");
    return;
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

  // Place summary before the content columns
  const contentColumns = document.getElementById("content-columns");
  if (contentColumns) {
    console.log("Placing contributor summary before content columns");
    contentColumns.insertAdjacentElement("beforebegin", summaryContainer);
  } else {
    console.warn("Content columns element not found, appending summary to body");
    document.body.appendChild(summaryContainer);
  }
}
