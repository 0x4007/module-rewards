// GitHub API Types
export interface GitHubIssue {
  number: number;
  title: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
  state: string;
  body: string;
}

export interface GitHubUser {
  login: string;
  html_url: string;
  avatar_url: string;
}

export interface GitHubComment {
  id: number;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
  path?: string; // For PR review comments
  position?: number; // For PR review comments
  commit_id?: string; // For PR review comments
  pull_request_url?: string; // For PR comments
}

export interface GitHubReview {
  id: number;
  user: GitHubUser;
  body: string;
  state: string;
  submitted_at: string;
  html_url: string;
  commit_id: string;
  pull_request_url: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
  state: string;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  body: string;
}

// Application Types
export interface UrlParseResult {
  owner: string;
  repo: string;
  number: string;
  type: "pr" | "issue";
}

export interface LinkedIssue {
  number: number;
  title: string;
  body: string;
  html_url: string;
  comments?: GitHubComment[]; // Comments from the linked issue
}

export interface LinkedPullRequest {
  number: number;
  title: string;
  url: string;
  state: string;
  author: {
    login: string;
  };
}

export interface FetchedData {
  details: GitHubPR | GitHubIssue;
  comments: GitHubComment[];
  type: "pr" | "issue";
  linkedIssue?: LinkedIssue; // Optional linked issue data
  linkedPullRequests?: LinkedPullRequest[]; // Optional linked PRs data (for issues)
}

export interface CommentScores {
  wordCount: number;
  original: number;
  logAdjusted: number;
  exponential: number;
}

export interface ScoringMetrics {
  original: number[];
  logAdjusted: number[];
  exponential: number[];
}
