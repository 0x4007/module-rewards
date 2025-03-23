export interface CommentScores {
  original: number;
  exponential: number;
}

export interface ScoringMetrics {
  original: number[];
  exponential: number[];
}

export interface ContributorStats {
  avatar: string;
  url: string;
  totalWords: number;
  originalScore: number;
  exponentialScore: number;
  commentCount: number;
}

export interface ContributorSummary {
  [key: string]: ContributorStats;
}
