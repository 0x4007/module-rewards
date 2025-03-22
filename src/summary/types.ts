export interface CommentScores {
  original: number;
  logAdjusted: number;
  exponential: number;
}

export interface ScoringMetrics {
  original: number[];
  logAdjusted: number[];
  exponential: number[];
}

export interface ContributorStats {
  avatar: string;
  url: string;
  totalWords: number;
  originalScore: number;
  logAdjustedScore: number;
  exponentialScore: number;
  commentCount: number;
}

export interface ContributorSummary {
  [key: string]: ContributorStats;
}
