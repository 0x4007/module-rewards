import { BaseScorer, BaseScorerConfig, ScorerResult } from "./base-scorer";

/**
 * Configuration for score aggregation
 */
export interface ScoreAggregatorConfig extends BaseScorerConfig {
  /**
   * Registered scorers with their weights
   */
  scorers: Array<{
    scorer: BaseScorer;
    weight?: number;
  }>;

  /**
   * How to combine scores:
   * - "weighted-average": weighted average of all scores (default)
   * - "minimum": minimum of all scores
   * - "maximum": maximum of all scores
   */
  strategy?: "weighted-average" | "minimum" | "maximum";
}

/**
 * Extended result interface for aggregated scoring
 */
export interface AggregatedScorerResult extends ScorerResult {
  metrics: {
    individualScores: Record<string, ScorerResult>;
    strategy: ScoreAggregatorConfig["strategy"];
    weights: Record<string, number>;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<ScoreAggregatorConfig> = {
  strategy: "weighted-average",
  weight: 1.0,
  debug: false,
};

/**
 * Aggregates results from multiple scorers into a single score
 */
export class ScoreAggregator extends BaseScorer<ScoreAggregatorConfig> {
  readonly id = "aggregator";

  constructor(config: ScoreAggregatorConfig) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Score content using all registered scorers and aggregate results
   */
  async score(content: string): Promise<AggregatedScorerResult> {
    // Collect scores from all scorers
    const scores = await Promise.all(
      this.config.scorers.map(async ({ scorer, weight }) => ({
        id: scorer.id,
        weight: weight ?? 1.0,
        result: await scorer.score(content),
      }))
    );

    if (this.config.debug) {
      console.log("Individual scores:", scores);
    }

    // Calculate aggregated normalized score
    const aggregatedScore = this.aggregateScores(scores);

    // Build metrics object
    const metrics = {
      individualScores: Object.fromEntries(
        scores.map(({ id, result }) => [id, result])
      ),
      strategy: this.config.strategy,
      weights: Object.fromEntries(
        scores.map(({ id, weight }) => [id, weight])
      ),
    };

    return {
      rawScore: aggregatedScore * 100,
      normalizedScore: this.applyWeight(aggregatedScore),
      metrics,
    };
  }

  /**
   * Aggregate individual scores based on the chosen strategy
   */
  private aggregateScores(
    scores: Array<{ id: string; weight: number; result: ScorerResult }>
  ): number {
    switch (this.config.strategy) {
      case "minimum":
        return Math.min(...scores.map(s => s.result.normalizedScore));

      case "maximum":
        return Math.max(...scores.map(s => s.result.normalizedScore));

      case "weighted-average":
      default:
        const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
        return scores.reduce(
          (sum, { weight, result }) =>
            sum + (result.normalizedScore * weight),
          0
        ) / totalWeight;
    }
  }
}
