/**
 * Main application type definitions
 */

/**
 * GitHub Comment type interface
 * Represents a comment in GitHub PR or issue
 */
export interface GitHubComment {
  id: number;
  body: string;
  user: {
    login: string;
    html_url: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  html_url: string;
}

/**
 * Comment section type
 * Represents the section that a comment belongs to (PR or issue)
 */
export type CommentSection = "pr" | "issue";

/**
 * Scoring algorithm type
 * Represents different types of scoring algorithms
 */
export type ScoringAlgorithm = "original" | "exponential" | "weighted";

/**
 * Header info type
 * Represents header information for a PR or issue
 */
export interface HeaderInfo {
  title: string;
  number: string;
}

/**
 * Score calculation function type
 * Function that calculates a score for a comment
 */
export type ScoreCalculator = (comment: GitHubComment) => {
  original: number;
  exponential: number;
};

/**
 * Comment scores interface
 * Represents calculated scores for a comment
 */
export interface CommentScores {
  wordCount: number;
  original: number;
  exponential: number;
  isGrouped?: boolean;
  groupWordCount?: number;
}
