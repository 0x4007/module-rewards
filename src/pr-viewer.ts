import { marked } from 'marked';
import { calculateAllScores } from './scoring';
import type { Comment, PullRequestDetails, ScoreSummary } from './types';

async function loadData(): Promise<void> {
    try {
        const [prDetails, prComments, issueComments] = await Promise.all([
            fetch('./data/pr-details.json').then(r => r.json()) as Promise<PullRequestDetails>,
            fetch('./data/pr-comments.json').then(r => r.json()) as Promise<Comment[]>,
            fetch('./data/issue-comments.json').then(r => r.json()) as Promise<Comment[]>
        ]);

        updatePRHeader(prDetails);
        const comments = processComments([...prComments, ...issueComments]);
        updateSummary(comments);
    } catch (error) {
        console.error('Error loading data:', error);
        document.body.innerHTML = `<div style="color: red; padding: 2rem;">
            Error loading PR data. Please check the console for details.
        </div>`;
    }
}

function updatePRHeader(prDetails: PullRequestDetails): void {
    const titleEl = document.querySelector('.pr-title');
    const metaEl = document.querySelector('.pr-meta');
    if (titleEl && metaEl) {
        titleEl.textContent = `${prDetails.title} (#${prDetails.number})`;
        metaEl.textContent = `Created by ${prDetails.user.login} on ${new Date(prDetails.created_at).toLocaleDateString()}`;
    }
}

function processComments(comments: Comment[]): ScoreSummary {
    const conversation = document.getElementById('conversation');
    if (!conversation) return { original: [], logAdjusted: [], exponential: [] };

    const scores: ScoreSummary = {
        original: [],
        logAdjusted: [],
        exponential: []
    };

    comments
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .forEach(comment => {
            const commentScores = calculateAllScores(comment.body);
            appendCommentToDOM(comment, commentScores, conversation);
            updateScoreSummary(commentScores, scores);
        });

    return scores;
}

function appendCommentToDOM(comment: Comment, scores: {
    wordCount: number;
    original: number;
    logAdjusted: number;
    exponential: number;
}, container: HTMLElement): void {
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
    container.appendChild(div);
}

function updateSummary(scores: ScoreSummary): void {
    const summaryDiv = document.querySelector('.algorithm-scores');
    if (!summaryDiv) return;

    const totalComments = scores.original.length;
    const totalWords = scores.original.reduce((sum, _, idx) => {
        const text = document.querySelectorAll('.comment')[idx]?.textContent || '';
        return sum + text.split(/\s+/).length;
    }, 0);

    const avgOriginal = scores.original.reduce((a, b) => a + b, 0) / totalComments;
    const avgLog = scores.logAdjusted.reduce((a, b) => a + b, 0) / totalComments;
    const avgExp = scores.exponential.reduce((a, b) => a + b, 0) / totalComments;

    summaryDiv.innerHTML = `
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
            <p>Avg Words/Comment: ${(totalWords/totalComments).toFixed(1)}</p>
        </div>
    `;
}

function updateScoreSummary(commentScores: {
    original: number;
    logAdjusted: number;
    exponential: number;
}, summary: ScoreSummary): void {
    summary.original.push(commentScores.original);
    summary.logAdjusted.push(commentScores.logAdjusted);
    summary.exponential.push(commentScores.exponential);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', loadData);
