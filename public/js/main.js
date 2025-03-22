// src/github-api.ts
function parsePrUrl(url) {
  try {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)\/pulls?\/(\d+)/;
    const match = url.match(regex);
    if (!match) {
      throw new Error("Invalid GitHub PR URL format");
    }
    return {
      owner: match[1],
      repo: match[2],
      number: match[3]
    };
  } catch (error) {
    throw new Error(`Could not parse GitHub PR URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}
async function fetchGitHubData(owner, repo, prNumber, token) {
  const headers = {
    "Accept": "application/vnd.github.v3+json"
  };
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }
  const baseUrl = "https://api.github.com";
  try {
    const prResponse = await fetch(
      `${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers }
    );
    if (!prResponse.ok) {
      if (prResponse.status === 401 || prResponse.status === 403) {
        throw new Error("Authentication failed. Please provide a valid GitHub token.");
      } else if (prResponse.status === 404) {
        throw new Error("PR not found. Check the URL or your access permissions.");
      } else {
        throw new Error(`GitHub API error: ${prResponse.status}`);
      }
    }
    const prDetails = await prResponse.json();
    const commentsResponse = await fetch(
      `${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
      { headers }
    );
    if (!commentsResponse.ok) {
      throw new Error(`Failed to fetch PR comments: ${commentsResponse.status}`);
    }
    const prComments = await commentsResponse.json();
    const issueCommentsResponse = await fetch(
      `${baseUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { headers }
    );
    if (!issueCommentsResponse.ok) {
      throw new Error(`Failed to fetch issue comments: ${issueCommentsResponse.status}`);
    }
    const issueComments = await issueCommentsResponse.json();
    return {
      prDetails,
      prComments,
      issueComments
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}

// src/scoring-utils.ts
function countWords(text) {
  if (!text || typeof text !== "string")
    return 0;
  let cleanedText = text.replace(/```[\s\S]*?```/g, "");
  cleanedText = cleanedText.replace(/`[^`]+`/g, "");
  cleanedText = cleanedText.replace(/https?:\/\/\S+/g, "");
  return cleanedText.trim().split(/\s+/).filter((word) => word.length > 0).length;
}
function calculateOriginalScore(wordCount) {
  return Math.pow(wordCount, 0.85);
}
function calculateLogAdjustedScore(wordCount) {
  return Math.pow(wordCount, 0.85) * (1 / Math.log2(wordCount + 2));
}
function calculateExponentialScore(wordCount) {
  return Math.pow(wordCount, 0.85) * Math.exp(-wordCount / 100);
}
function calculateAllScores(text) {
  const wordCount = countWords(text);
  return {
    wordCount,
    original: calculateOriginalScore(wordCount),
    logAdjusted: calculateLogAdjustedScore(wordCount),
    exponential: calculateExponentialScore(wordCount)
  };
}

// src/main.ts
var prUrlInput;
var analyzeBtn;
var loadingIndicator;
var errorMessage;
var prDetailsElement;
var prTitle;
var prMeta;
var algorithmScores;
var conversation;
var githubToken = localStorage.getItem("github_token");
document.addEventListener("DOMContentLoaded", () => {
  prUrlInput = document.getElementById("pr-url");
  analyzeBtn = document.getElementById("analyze-btn");
  loadingIndicator = document.getElementById("loading-indicator");
  errorMessage = document.getElementById("error-message");
  prDetailsElement = document.getElementById("pr-details");
  prTitle = document.querySelector(".pr-title");
  prMeta = document.querySelector(".pr-meta");
  algorithmScores = document.querySelector(".algorithm-scores");
  conversation = document.getElementById("conversation");
  analyzeBtn.addEventListener("click", analyzePR);
  prUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter")
      analyzePR();
  });
  const lastPrUrl = localStorage.getItem("last_pr_url");
  if (lastPrUrl && prUrlInput) {
    prUrlInput.value = lastPrUrl;
  }
});
function promptForGitHubToken() {
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
async function analyzePR() {
  clearResults();
  loadingIndicator.classList.remove("hidden");
  errorMessage.classList.add("hidden");
  const prUrl = prUrlInput.value.trim();
  if (!prUrl) {
    showError("Please enter a GitHub PR URL");
    return;
  }
  localStorage.setItem("last_pr_url", prUrl);
  try {
    const { owner, repo, number } = parsePrUrl(prUrl);
    let data;
    try {
      data = await fetchGitHubData(owner, repo, number, githubToken || void 0);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Authentication failed") && promptForGitHubToken()) {
        try {
          data = await fetchGitHubData(owner, repo, number, githubToken || void 0);
        } catch (retryError) {
          throw retryError;
        }
      } else {
        throw error;
      }
    }
    updatePRHeader(data.prDetails);
    const comments = processComments([...data.prComments, ...data.issueComments]);
    updateSummary(comments);
    prDetailsElement.classList.remove("hidden");
    algorithmScores.classList.remove("hidden");
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    loadingIndicator.classList.add("hidden");
  }
}
function clearResults() {
  conversation.innerHTML = "";
  algorithmScores.innerHTML = "";
  prTitle.textContent = "Loading PR...";
  prMeta.textContent = "";
}
function showError(message) {
  loadingIndicator.classList.add("hidden");
  errorMessage.classList.remove("hidden");
  errorMessage.textContent = message;
}
function updatePRHeader(prDetails) {
  prTitle.textContent = `${prDetails.title} (#${prDetails.number})`;
  prMeta.textContent = `Created by ${prDetails.user.login} on ${new Date(prDetails.created_at).toLocaleDateString()}`;
}
function processComments(comments) {
  const scores = {
    original: [],
    logAdjusted: [],
    exponential: []
  };
  comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach((comment) => {
    if (!comment.body)
      return;
    const commentScores = calculateAllScores(comment.body);
    appendCommentToDOM(comment, commentScores);
    updateScoreSummary(commentScores, scores);
  });
  return scores;
}
function appendCommentToDOM(comment, scores) {
  const div = document.createElement("div");
  div.className = "comment";
  div.innerHTML = `
    <div class="comment-header">
      <a href="${comment.user.html_url}" class="username">${comment.user.login}</a>
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
function updateSummary(scores) {
  const totalComments = scores.original.length;
  if (totalComments === 0) {
    algorithmScores.innerHTML = "<p>No comments found for this PR.</p>";
    return;
  }
  const totalWords = scores.original.reduce((sum, _, idx) => {
    const commentElement = document.querySelectorAll(".comment")[idx];
    if (!commentElement)
      return sum;
    const text = commentElement.querySelector(".score-info")?.textContent || "";
    const wordMatch = text.match(/Words: (\d+)/);
    return sum + (wordMatch ? parseInt(wordMatch[1], 10) : 0);
  }, 0);
  const avgOriginal = scores.original.reduce((a, b) => a + b, 0) / totalComments;
  const avgLog = scores.logAdjusted.reduce((a, b) => a + b, 0) / totalComments;
  const avgExp = scores.exponential.reduce((a, b) => a + b, 0) / totalComments;
  algorithmScores.innerHTML = `
    <div class="algorithm-score">
      <h3>Original Score</h3>
      <p>Average: ${avgOriginal.toFixed(2)}</p>
    </div>
    <div class="algorithm-score">
      <h3>Log-Adjusted Score</h3>
      <p>Average: ${avgLog.toFixed(2)}</p>
    </div>
    <div class="algorithm-score">
      <h3>Exponential Score</h3>
      <p>Average: ${avgExp.toFixed(2)}</p>
    </div>
    <div class="algorithm-score">
      <h3>Statistics</h3>
      <p>Total Comments: ${totalComments}</p>
      <p>Total Words: ${totalWords}</p>
      <p>Avg Words/Comment: ${(totalWords / totalComments).toFixed(1)}</p>
    </div>
  `;
}
function updateScoreSummary(commentScores, summary) {
  summary.original.push(commentScores.original);
  summary.logAdjusted.push(commentScores.logAdjusted);
  summary.exponential.push(commentScores.exponential);
}
//# sourceMappingURL=main.js.map
