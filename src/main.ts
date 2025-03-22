import { marked } from 'marked';
import { fetchGitHubData, parsePrUrl } from './github-api';
import { calculateAllScores } from './scoring-utils';
import { CommentScores, GitHubComment, ScoringMetrics } from './types';

// Make marked available globally for markdown rendering
declare global {
  interface Window {
    marked: typeof marked;
  }
}

// DOM elements
let prUrlInput: HTMLInputElement;
let analyzeBtn: HTMLButtonElement;
let loadingIndicator: HTMLElement;
let errorMessage: HTMLElement;
let prDetailsElement: HTMLElement;
let prTitle: HTMLElement;
let prMeta: HTMLElement;
let algorithmScores: HTMLElement;
let conversation: HTMLElement;
let githubToken: string | null = localStorage.getItem('github_token');

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Initialize DOM elements
  prUrlInput = document.getElementById('pr-url') as HTMLInputElement;
  analyzeBtn = document.getElementById('analyze-btn') as HTMLButtonElement;
  loadingIndicator = document.getElementById('loading-indicator') as HTMLElement;
  errorMessage = document.getElementById('error-message') as HTMLElement;
  prDetailsElement = document.getElementById('pr-details') as HTMLElement;
  prTitle = document.querySelector('.pr-title') as HTMLElement;
  prMeta = document.querySelector('.pr-meta') as HTMLElement;
  algorithmScores = document.querySelector('.algorithm-scores') as HTMLElement;
  conversation = document.getElementById('conversation') as HTMLElement;

  // Add event listeners
  analyzeBtn.addEventListener('click', analyzePR);
  prUrlInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') analyzePR();
  });

  // Restore last PR URL if exists
  const lastPrUrl = localStorage.getItem('last_pr_url');
  if (lastPrUrl && prUrlInput) {
    prUrlInput.value = lastPrUrl;
  }
});

// Handle GitHub token input
function promptForGitHubToken(): boolean {
  const token = prompt(
    'GitHub API requires authentication for better rate limits.\nPlease enter your GitHub personal access token:',
    githubToken || ''
  );

  if (token) {
    githubToken = token;
    localStorage.setItem('github_token', token);
    return true;
  }

  return false;
}

// Analyze PR using user input
async function analyzePR(): Promise<void> {
  // Clear previous results
  clearResults();

  // Show loading state
  loadingIndicator.classList.remove('hidden');
  errorMessage.classList.add('hidden');

  // Get PR URL
  const prUrl = prUrlInput.value.trim();
  if (!prUrl) {
    showError('Please enter a GitHub PR URL');
    return;
  }

  // Save the URL for future use
  localStorage.setItem('last_pr_url', prUrl);

  try {
    // Parse PR URL
    const { owner, repo, number } = parsePrUrl(prUrl);

    // Try to fetch data
    let data;
    // Check cache first
    const cacheKey = `pr-data-${prUrl}`;
    const cachedData = localStorage.getItem(cacheKey);
    const cacheTimestamp = localStorage.getItem(`${cacheKey}-timestamp`);
    const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds

    // Check if cache exists and is not expired
    if (cachedData && cacheTimestamp && (Date.now() - Number(cacheTimestamp)) < ONE_HOUR) {
      data = JSON.parse(cachedData);
    } else {
      try {
        data = await fetchGitHubData(owner, repo, number, githubToken || undefined);
        // Cache the data with timestamp
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
      } catch (error) {
        // If auth error, prompt for token and retry
        if (error instanceof Error &&
            error.message.includes('Authentication failed') &&
            promptForGitHubToken()) {
          try {
            data = await fetchGitHubData(owner, repo, number, githubToken || undefined);
            // Cache the data after successful retry
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
          } catch (retryError) {
            throw retryError;
          }
        } else {
          throw error;
        }
      }
    }

    // Process the data
    updatePRHeader(data.prDetails);
    const comments = processComments([...data.prComments, ...data.issueComments]);
    updateSummary(comments);

    // Show results
    prDetailsElement.classList.remove('hidden');
    algorithmScores.classList.remove('hidden');

  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    loadingIndicator.classList.add('hidden');
  }
}

// Clear previous results
function clearResults(): void {
  conversation.innerHTML = '';
  algorithmScores.innerHTML = '';
  prTitle.textContent = 'Loading PR...';
  prMeta.textContent = '';
}

// Display error
function showError(message: string): void {
  loadingIndicator.classList.add('hidden');
  errorMessage.classList.remove('hidden');
  errorMessage.textContent = message;
}

function updatePRHeader(prDetails: any): void {
  prTitle.textContent = `${prDetails.title} (#${prDetails.number})`;
  prMeta.textContent = `Created by ${prDetails.user.login} on ${new Date(prDetails.created_at).toLocaleDateString()}`;
}

function processComments(comments: GitHubComment[]): ScoringMetrics {
  const scores: ScoringMetrics = {
    original: [],
    logAdjusted: [],
    exponential: []
  };

  comments
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach(comment => {
      if (!comment.body) return; // Skip comments without body

      const commentScores = calculateAllScores(comment.body);
      appendCommentToDOM(comment, commentScores);
      updateScoreSummary(commentScores, scores);
    });

  return scores;
}

function appendCommentToDOM(comment: GitHubComment, scores: CommentScores): void {
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

function updateSummary(scores: ScoringMetrics): void {
  const totalComments = scores.original.length;
  if (totalComments === 0) {
    algorithmScores.innerHTML = '<p>No comments found for this PR.</p>';
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

function updateScoreSummary(commentScores: CommentScores, summary: ScoringMetrics): void {
  summary.original.push(commentScores.original);
  summary.logAdjusted.push(commentScores.logAdjusted);
  summary.exponential.push(commentScores.exponential);
}
