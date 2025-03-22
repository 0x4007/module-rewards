import { meta } from "./main";
import { ScoringMetrics } from "./types";

export function updateSummary(scores: ScoringMetrics): void {
  const totalComments = scores.original.length;
  if (totalComments === 0) {
    return;
  }

  // Calculate average scores
  const avgOriginal = scores.original.reduce((a, b) => a + b, 0) / totalComments;
  const avgLog = scores.logAdjusted.reduce((a, b) => a + b, 0) / totalComments;
  const avgExp = scores.exponential.reduce((a, b) => a + b, 0) / totalComments;

  // Update meta info with averages
  if (meta) {
    meta.textContent = `Total comments: ${totalComments} | Avg Exp Score: ${avgExp.toFixed(2)}`;
  }
}
