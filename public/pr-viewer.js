// Import marked for markdown rendering
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@9.0.0/lib/marked.esm.min.js';

// Cache for GitHub token
let githubToken = localStorage.getItem('github_token');

// DOM elements
const prUrlInput = document.getElementById('pr-url');
const analyzeBtn = document.getElementById('analyze-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessage = document.getElementById('error-message');
const prDetails = document.getElementById('pr-details');
const prTitle = document.querySelector('.pr-title');
const prMeta = document.querySelector('.pr-meta');
const algorithmScores = document.querySelector('.algorithm-scores');
const conversation = document.getElementById('conversation');

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    analyzeBtn.addEventListener('click', analyzePR);
    prUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') analyzePR();
    });
});

// Parse GitHub PR URL
function parsePrUrl(url) {
    try {
        // Handle different URL formats
        // Example formats:
        // https://github.com/owner/repo/pull/123
        // https://github.com/owner/repo/pulls/123
        const regex = /github\.com\/([^\/]+)\/([^\/]+)\/pulls?\/(\d+)/;
        const match = url.match(regex);

        if (!match) {
            throw new Error('Invalid GitHub PR URL format');
        }

        return {
            owner: match[1],
            repo: match[2],
            number: match[3]
        };
    } catch (error) {
        throw new Error('Could not parse GitHub PR URL: ' + error.message);
    }
}

// Fetch GitHub data
async function fetchGitHubData(owner, repo, prNumber) {
    const headers = {
        'Accept': 'application/vnd.github.v3+json'
    };

    // Add authorization header if token exists
    if (githubToken) {
        headers['Authorization'] = `token ${githubToken}`;
    }

    // Base GitHub API URL
    const baseUrl = 'https://api.github.com';

    try {
        // Fetch PR details
        const prResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`,
            { headers }
        );

        if (!prResponse.ok) {
            if (prResponse.status === 401 || prResponse.status === 403) {
                // Handle auth errors - prompt for token
                throw new Error('Authentication failed. Please provide a valid GitHub token.');
            } else if (prResponse.status === 404) {
                throw new Error('PR not found. Check the URL or your access permissions.');
            } else {
                throw new Error(`GitHub API error: ${prResponse.status}`);
            }
        }

        const prDetails = await prResponse.json();

        // Fetch PR comments
        const commentsResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/comments`,
            { headers }
        );

        if (!commentsResponse.ok) {
            throw new Error(`Failed to fetch PR comments: ${commentsResponse.status}`);
        }

        const prComments = await commentsResponse.json();

        // Fetch issue comments
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
        throw error;
    }
}

// Handle GitHub token input
function promptForGitHubToken() {
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

// Analyze PR
async function analyzePR() {
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

    try {
        // Parse PR URL
        const { owner, repo, number } = parsePrUrl(prUrl);

        // Try to fetch data
        let data;
        try {
            data = await fetchGitHubData(owner, repo, number);
        } catch (error) {
            // If auth error, prompt for token and retry
            if (error.message.includes('Authentication failed') && promptForGitHubToken()) {
                try {
                    data = await fetchGitHubData(owner, repo, number);
                } catch (retryError) {
                    throw retryError;
                }
            } else {
                throw error;
            }
        }

        // Process the data
        updatePRHeader(data.prDetails);
        const comments = processComments([...data.prComments, ...data.issueComments]);
        updateSummary(comments);

        // Show results
        prDetails.classList.remove('hidden');
        algorithmScores.classList.remove('hidden');

    } catch (error) {
        showError(error.message);
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

// Clear previous results
function clearResults() {
    conversation.innerHTML = '';
    algorithmScores.innerHTML = '';
    prTitle.textContent = 'Loading PR...';
    prMeta.textContent = '';
}

// Display error
function showError(message) {
    loadingIndicator.classList.add('hidden');
    errorMessage.classList.remove('hidden');
    errorMessage.textContent = message;
}

// Update PR header
function updatePRHeader(prDetails) {
    prTitle.textContent = `${prDetails.title} (#${prDetails.number})`;
    prMeta.textContent = `Created by ${prDetails.user.login} on ${new Date(prDetails.created_at).toLocaleDateString()}`;
}

// Process comments
function processComments(comments) {
    const scores = {
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

// Add comment to DOM
function appendCommentToDOM(comment, scores) {
    const div = document.createElement('div');
    div.className = 'comment';
    div.innerHTML = `
        <div class="comment-header">
            <img class="avatar" src="${comment.user.avatar_url}" alt="${comment.user.login}">
            <div class="comment-meta">
                <a href="${comment.user.html_url}" class="username">${comment.user.login}</a>
                <div class="timestamp">
                    commented on ${new Date(comment.created_at).toLocaleString()}
                </div>
            </div>
        </div>
        <div class="comment-body markdown">
            ${marked.parse(comment.body)}
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

// Update score summary
function updateSummary(scores) {
    const totalComments = scores.original.length;
    if (totalComments === 0) {
        algorithmScores.innerHTML = '<p>No comments found for this PR.</p>';
        return;
    }

    const totalWords = scores.original.reduce((sum, _, idx) => {
        const commentElement = document.querySelectorAll('.comment')[idx];
        if (!commentElement) return sum;

        const text = commentElement.querySelector('.score-info')?.textContent || '';
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

// Update score summary
function updateScoreSummary(commentScores, summary) {
    summary.original.push(commentScores.original);
    summary.logAdjusted.push(commentScores.logAdjusted);
    summary.exponential.push(commentScores.exponential);
}

// Scoring functions
function countWords(text) {
    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`[^`]+`/g, '');

    // Remove URLs
    text = text.replace(/https?:\/\/\S+/g, '');

    // Count words
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
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
