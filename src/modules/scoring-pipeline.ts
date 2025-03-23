import { BaseModule } from "../core/module-base";
import { BaseScorer } from "../scorers/base-scorer";
import { ScoreAggregator, ScoreAggregatorConfig } from "../scorers/score-aggregator";
import { CloudEvent } from "../utils/cloud-events";

/**
 * Configuration for the scoring pipeline
 */
export interface ScoringPipelineConfig {
  /**
   * Registered scorers with optional weights
   */
  scorers: Array<{
    scorer: BaseScorer;
    weight?: number;
  }>;

  /**
   * How to aggregate scores:
   * - "weighted-average": weighted average of all scores (default)
   * - "minimum": minimum of all scores
   * - "maximum": maximum of all scores
   */
  aggregationStrategy?: ScoreAggregatorConfig["strategy"];

  /**
   * Enable debug output
   */
  debug?: boolean;
}

/**
 * Module that orchestrates content scoring using registered scorers
 */
export class ScoringPipeline extends BaseModule<ScoringPipelineConfig> {
  readonly name = "scoring-pipeline";
  readonly supportedEventTypes = /.*/;

  private aggregator: ScoreAggregator;

  constructor(config: ScoringPipelineConfig) {
    super(config);

    // Initialize score aggregator
    this.aggregator = new ScoreAggregator({
      scorers: config.scorers,
      strategy: config.aggregationStrategy,
      debug: config.debug,
    });
  }

  /**
   * Process content through all registered scorers
   */
  async transform(event: CloudEvent, result: Record<string, any>): Promise<Record<string, any>> {
    // Skip if content was filtered
    if (result.filtered === true) {
      if (this.config.debug) {
        console.log("Content was filtered, skipping scoring pipeline");
      }
      return result;
    }

    // Get content to score
    const content = this.extractContent(event, result);
    if (!content) {
      if (this.config.debug) {
        console.log("No content found to score");
      }
      return result;
    }

    // Run content through scoring pipeline
    const scores = await this.aggregator.score(content);

    // Debug logging for detailed inspection
    console.log("FULL SCORES OBJECT:", JSON.stringify(scores, null, 2));
    console.log("METRICS:", JSON.stringify(scores.metrics, null, 2));
    console.log("INDIVIDUAL SCORES:", JSON.stringify(scores.metrics.individualScores, null, 2));

    if (this.config.debug) {
      console.log("Scoring pipeline results:", scores);
    }

    // Extract normalized scores from individual scorers for UI display
    const simplifiedScores: Record<string, number> = {};

    // Convert complex score objects to simple numerical values for the UI
    Object.entries(scores.metrics.individualScores).forEach(([key, scoreObj]) => {
      simplifiedScores[key] = scoreObj.normalizedScore;
    });

    // Return result with scores added
    return {
      ...result,
      scores: simplifiedScores,
      aggregatedScore: {
        raw: scores.rawScore,
        normalized: scores.normalizedScore,
        strategy: scores.metrics.strategy,
        weights: scores.metrics.weights,
      },
    };
  }

  /**
   * Extract scorable content from event/result
   */
  private extractContent(event: CloudEvent, result: Record<string, any>): string | undefined {
    // First check if content was already extracted
    if (result.content && typeof result.content === "string") {
      return result.content;
    }

    const data = event.data as any;

    // First try to get content directly from our analyzer's format
    if (data?.content !== undefined) {
      return data.content;
    }

    // Fallback to checking other common locations
    return data?.body || data?.text;
  }
}
