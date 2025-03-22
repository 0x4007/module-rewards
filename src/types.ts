// GitHub API Types
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
}

export interface GitHubPR {
  number: number;
  title: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
  state: string;
}

// Application Types
export interface PRParseResult {
  owner: string;
  repo: string;
  number: string;
}

export interface PRData {
  prDetails: GitHubPR;
  prComments: GitHubComment[];
  issueComments: GitHubComment[];
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
