import { CommentScores, ScoringMetrics } from "./types";

export function updateScoreSummary(commentScores: CommentScores, summary: ScoringMetrics): void {
  summary.original.push(commentScores.original);
  summary.logAdjusted.push(commentScores.logAdjusted);
  summary.exponential.push(commentScores.exponential);
}
