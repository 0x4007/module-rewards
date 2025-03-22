import { appendCommentToDOM } from "./appendCommentToDOM";
import { issueConversation } from "./main";
import { calculateAllScores } from "./scoring-utils";
import { GitHubComment, ScoringMetrics } from "./types";
import { updateScoreSummary } from "./updateScoreSummary";

// Process Issue comments and display in Issue column
export function processIssueComments(comments: GitHubComment[]): {
  metrics: ScoringMetrics;
  contributors: {
    [key: string]: {
      avatar: string;
      url: string;
      totalWords: number;
      originalScore: number;
      logAdjustedScore: number;
      exponentialScore: number;
      commentCount: number;
    };
  };
} {
  const scores: ScoringMetrics = {
    original: [],
    logAdjusted: [],
    exponential: [],
  };

  // Track contributor scores
  const contributors: {
    [key: string]: {
      avatar: string;
      url: string;
      totalWords: number;
      originalScore: number;
      logAdjustedScore: number;
      exponentialScore: number;
      commentCount: number;
    };
  } = {};

  if (comments.length === 0) {
    // Display a message when there are no issue comments
    const noCommentsDiv = document.createElement("div");
    noCommentsDiv.className = "no-content-message";
    noCommentsDiv.innerHTML = `<p>No issue content available.</p>`;
    issueConversation.appendChild(noCommentsDiv);
    return {
      metrics: scores,
      contributors
    };
  }

  comments
    .sort((a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime())
    .forEach((comment) => {
      if (!comment.body) return; // Skip comments without body

      const commentScores = calculateAllScores(comment.body);
      appendCommentToDOM(comment, commentScores, issueConversation); // Add to Issue column
      updateScoreSummary(commentScores, scores);

      // Update contributor totals if we have user info
      if (comment.user && comment.user.login) {
        const login = comment.user.login;
        if (!contributors[login]) {
          contributors[login] = {
            avatar: comment.user.avatar_url || "",
            url: comment.user.html_url || "",
            totalWords: 0,
            originalScore: 0,
            logAdjustedScore: 0,
            exponentialScore: 0,
            commentCount: 0,
          };
        }
        contributors[login].totalWords += commentScores.wordCount;
        contributors[login].originalScore += commentScores.original;
        contributors[login].logAdjustedScore += commentScores.logAdjusted;
        contributors[login].exponentialScore += commentScores.exponential;
        contributors[login].commentCount++;
      }
    });

  return {
    metrics: scores,
    contributors
  };
}
