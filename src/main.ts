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

    // Function to process and display data
    const processAndDisplayData = (newData: FetchedData, isBackground = false) => {
      updateHeader(newData);
      const comments = processComments(newData.comments);
      updateSummary(comments);

      // Show results
      detailsElement.classList.remove('hidden');
      algorithmScores.classList.remove('hidden');

      // If this is background update, show a notification
        localStorage.setItem(`${cacheKey}-timestamp`, Date.now().toString());
      } catch (error) {
        // If auth error, prompt for token and retry
        if (error instanceof Error &&
            error.message.includes('Authentication failed') &&
            promptForGitHubToken()) {
          try {
            data = await fetchGitHubData(owner, repo, number, type, githubToken || undefined);
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
    updateHeader(data);
    const comments = processComments(data.comments);
    updateSummary(comments);

    // Show results
    detailsElement.classList.remove('hidden');
    algorithmScores.classList.remove('hidden');

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
        <a href="${data.details.user.html_url}" class="username">${data.details.user.login}</a>
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
