import { marked } from 'marked';
import { fetchGitHubData, parseUrl } from './github-api';
import { calculateAllScores } from './scoring-utils';
import { CommentScores, GitHubComment, FetchedData, ScoringMetrics } from './types';

// Make marked available globally for markdown rendering
declare global {
  interface Window {
    marked: typeof marked;
  }
}

// DOM elements
let urlInput: HTMLInputElement;
let analyzeBtn: HTMLButtonElement;
let loadingIndicator: HTMLElement;
let errorMessage: HTMLElement;
let detailsElement: HTMLElement;
let title: HTMLElement;
let meta: HTMLElement;
let algorithmScores: HTMLElement;
let conversation: HTMLElement;
let githubToken: string | null = localStorage.getItem('github_token');

// Initialize when DOM is ready
// Setup WebSocket connection for live reload
const ws = new WebSocket('ws://localhost:8080');
ws.onmessage = (event) => {
  if (event.data === 'reload') {
    console.log('Reloading page due to TypeScript changes...');
    window.location.reload();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  try {
    // Initialize DOM elements
    urlInput = document.getElementById('url-input') as HTMLInputElement;
    analyzeBtn = document.getElementById('analyze-btn') as HTMLButtonElement;
    loadingIndicator = document.getElementById('loading-indicator') as HTMLElement;
    errorMessage = document.getElementById('error-message') as HTMLElement;
    detailsElement = document.getElementById('details') as HTMLElement;
    title = document.querySelector('#details .title') as HTMLElement;
    meta = document.querySelector('#details .meta') as HTMLElement;
    algorithmScores = document.querySelector('.algorithm-scores') as HTMLElement;
    conversation = document.getElementById('conversation') as HTMLElement;

    // Verify all required elements are present
    if (!urlInput || !analyzeBtn || !loadingIndicator || !errorMessage ||
        !detailsElement || !title || !meta || !algorithmScores || !conversation) {
      throw new Error('Required DOM elements not found. Check HTML structure.');
    }

    // Add event listeners
    analyzeBtn.addEventListener('click', analyze);
    urlInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') analyze();
    });

    // Restore last PR URL if exists
    const lastUrl = localStorage.getItem('last_url');
    if (lastUrl && urlInput) {
      urlInput.value = lastUrl;
    }
  } catch (error) {
    console.error('Failed to initialize:', error);
    document.body.innerHTML = `<div class="error-message">Failed to initialize application: ${error instanceof Error ? error.message : String(error)}</div>`;
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
async function analyze(): Promise<void> {
  // Clear previous results
  clearResults();

  // Show loading state
  loadingIndicator.classList.remove('hidden');
  errorMessage.classList.add('hidden');

  // Get URL
  const url = urlInput.value.trim();
  if (!url) {
    showError('Please enter a GitHub PR or Issue URL');
    return;
  }

  // Save the URL for future use
  localStorage.setItem('last_url', url);

  try {
    // Parse URL
    const { owner, repo, number, type } = parseUrl(url);

    // Setup cache keys
    const cacheKey = `data-${url}`;
    const cachedData = localStorage.getItem(cacheKey);
    let data;

    // Function to create a simple hash of the data
    const hashData = (data: FetchedData): string => {
      const relevantData = {
        title: data.details.title,
        body: data.details.body,
        comments: data.comments.map(c => ({
          id: c.id,
          body: c.body,
          updated_at: c.updated_at
        }))
      };
      return JSON.stringify(relevantData);
    };

    // Function to process and display data
    const processAndDisplayData = (newData: FetchedData, oldData?: FetchedData) => {
      updateHeader(newData);
      const comments = processComments(newData.comments);
      updateSummary(comments);

      // Show results
      detailsElement.classList.remove('hidden');
      algorithmScores.classList.remove('hidden');

      // If this is a background update and data has changed, show notification
      if (oldData && hashData(newData) !== hashData(oldData)) {
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.textContent = 'Content updated with latest data';
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
        setTimeout(() => notification.style.opacity = '1', 0);

        // Fade out and remove after 3 seconds
        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => notification.remove(), 300);
        }, 3000);
      }
    };

    // Function to fetch fresh data
    const fetchFreshData = async () => {
      try {
        const freshData = await fetchGitHubData(owner, repo, number, type, githubToken || undefined);
        const currentData = cachedData ? JSON.parse(cachedData) : undefined;
        // Cache the fresh data
        localStorage.setItem(cacheKey, JSON.stringify(freshData));
        localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
        // Update UI with fresh data only if changed
        processAndDisplayData(freshData, currentData);
      } catch (error) {
        // Only handle auth errors in background fetch
        if (error instanceof Error &&
            error.message.includes('Authentication failed') &&
            promptForGitHubToken()) {
          try {
            const freshData = await fetchGitHubData(owner, repo, number, type, githubToken || undefined);
            const currentData = cachedData ? JSON.parse(cachedData) : undefined;
            localStorage.setItem(cacheKey, JSON.stringify(freshData));
            localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
            processAndDisplayData(freshData, currentData);
          } catch (retryError) {
            console.error('Background fetch failed after token retry:', retryError);
          }
        } else {
          console.error('Background fetch failed:', error);
        }
      }
    };

    // If we have cached data, use it immediately
    if (cachedData) {
      data = JSON.parse(cachedData);
      processAndDisplayData(data, undefined);

      // Start background fetch if cache is older than 5 minutes
      const cacheTimestamp = localStorage.getItem(`${cacheKey}-timestamp`);
      const FIVE_MINUTES = 5 * 60 * 1000;
      if (!cacheTimestamp || (Date.now() - Number(cacheTimestamp)) > FIVE_MINUTES) {
        fetchFreshData();
      }
    } else {
      // No cache, fetch data normally
      try {
        data = await fetchGitHubData(owner, repo, number, type, githubToken || undefined);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
        processAndDisplayData(data, undefined);
      } catch (error) {
        if (error instanceof Error &&
            error.message.includes('Authentication failed') &&
            promptForGitHubToken()) {
          try {
            data = await fetchGitHubData(owner, repo, number, type, githubToken || undefined);
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
            processAndDisplayData(data);
          } catch (retryError) {
            throw retryError;
          }
        } else {
          throw error;
        }
      }
    }

  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    loadingIndicator.classList.add('hidden');
  }
}

// Clear previous results
function clearResults(): void {
  if (conversation) conversation.innerHTML = '';
  if (algorithmScores) algorithmScores.innerHTML = '';
  if (title) title.textContent = 'Loading...';
  if (meta) meta.textContent = '';
  // Remove existing summary if present
  const existingSummary = document.querySelector('.contributor-summary');
  if (existingSummary) {
    existingSummary.remove();
  }
}

// Display error
function showError(message: string): void {
  loadingIndicator.classList.add('hidden');
  errorMessage.classList.remove('hidden');
  errorMessage.textContent = message;
}

function updateHeader(data: FetchedData): void {
  title.textContent = `${data.details.title} (#${data.details.number})`;

  // Create the initial comment with the issue/PR body
  if (data.details.body) {
    const div = document.createElement("div");
    div.className = "comment";
    div.innerHTML = `
      <div class="comment-header">
        <div class="user-info">
          <img src="${data.details.user.avatar_url}" alt="${data.details.user.login}" class="avatar" />
          <a href="${data.details.user.html_url}" class="username">${data.details.user.login}</a>
        </div>
        <div class="timestamp">
          ${new Date(data.details.created_at).toLocaleString()}
        </div>
      </div>
      <div class="comment-body markdown">
        ${window.marked.parse(data.details.body)}
      </div>
    `;
    conversation.insertBefore(div, conversation.firstChild);
  }
}

function processComments(comments: GitHubComment[]): ScoringMetrics {
    const scores: ScoringMetrics = {
      original: [],
      logAdjusted: [],
      exponential: []
    };

    // Track contributor scores
    const contributors: { [key: string]: {
      avatar: string,
      url: string,
      totalWords: number,
      originalScore: number,
      logAdjustedScore: number,
      exponentialScore: number,
      commentCount: number
    }} = {};

    comments
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach(comment => {
        if (!comment.body) return; // Skip comments without body

        const commentScores = calculateAllScores(comment.body);
        appendCommentToDOM(comment, commentScores);
        updateScoreSummary(commentScores, scores);

        // Update contributor totals
        const login = comment.user.login;
        if (!contributors[login]) {
          contributors[login] = {
            avatar: comment.user.avatar_url,
            url: comment.user.html_url,
            totalWords: 0,
            originalScore: 0,
            logAdjustedScore: 0,
            exponentialScore: 0,
            commentCount: 0
          };
        }
        contributors[login].totalWords += commentScores.wordCount;
        contributors[login].originalScore += commentScores.original;
        contributors[login].logAdjustedScore += commentScores.logAdjusted;
        contributors[login].exponentialScore += commentScores.exponential;
        contributors[login].commentCount++;
      });

    // Update summary
    updateContributorSummary(contributors);

    return scores;
}

function appendCommentToDOM(comment: GitHubComment, scores: CommentScores): void {
  const div = document.createElement("div");
  div.className = "comment";
    div.innerHTML = `
    <div class="comment-header">
      <div class="user-info">
        <img src="${comment.user.avatar_url}" alt="${comment.user.login}" class="avatar" />
        <a href="${comment.user.html_url}" class="username">${comment.user.login}</a>
      </div>
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
    algorithmScores.innerHTML = '<p>No comments found.</p>';
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

function updateContributorSummary(contributors: { [key: string]: {
  avatar: string,
  url: string,
  totalWords: number,
  originalScore: number,
  logAdjustedScore: number,
  exponentialScore: number,
  commentCount: number
}}): void {
  // Remove any existing summary before creating a new one
  const existingSummary = document.querySelector('.contributor-summary');
  if (existingSummary) {
    existingSummary.remove();
  }

  const summaryContainer = document.createElement('div');
  summaryContainer.className = 'contributor-summary';
  summaryContainer.innerHTML = '<h3>Contributor Summary</h3>';

  const sortedContributors = Object.entries(contributors)
    .sort(([, a], [, b]) => b.exponentialScore - a.exponentialScore);

  const summaryList = document.createElement('div');
  summaryList.className = 'contributor-list';

  sortedContributors.forEach(([login, stats]) => {
    const contributorEl = document.createElement('div');
    contributorEl.className = 'contributor-item';
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

  // Place summary before the conversation
  const conversation = document.getElementById('conversation');
  if (conversation) {
    conversation.insertAdjacentElement('beforebegin', summaryContainer);
  }
}
