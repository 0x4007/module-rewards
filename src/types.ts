export interface User {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface Comment {
  user: User;
  body: string;
  created_at: string;
}

export interface PullRequestDetails {
  title: string;
  number: number;
  user: User;
  created_at: string;
}

export interface ScoreSummary {
  original: number[];
  logAdjusted: number[];
  exponential: number[];
}
