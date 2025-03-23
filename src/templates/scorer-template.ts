import { BaseScorer, BaseScorerConfig, ScorerResult } from "../scorers/base-scorer";

/**
 * Configuration options for the new scorer
 */
export interface CustomScorerConfig extends BaseScorerConfig {
  /**
   * Add scorer-specific configuration options here
   * Example:
   * targetValue?: number;
   * weights?: Record<string, number>;
   */
}

/**
 * Extended result interface for custom scoring
 */
export interface CustomScorerResult extends ScorerResult {
  metrics: {
    /**
     * Add scorer-specific metrics here
     * Example:
     * specificScore: number;
     * details: Record<string, any>;
     */
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: CustomScorerConfig = {
  weight: 1.0,
  debug: false,
  // Add default values for custom config options
};

/**
 * Template for implementing a new scoring strategy
 */
export class CustomScorer extends BaseScorer<CustomScorerConfig> {
  readonly id = "custom-scorer"; // Change this to your scorer's unique ID

  constructor(config: Partial<CustomScorerConfig> = {}) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Score content based on your custom metrics
   */
  async score(content: string): Promise<CustomScorerResult> {
    // Implement your scoring logic here
    let calculatedScore = 0;

    try {
      // Example scoring implementation:
      // 1. Process the content
      // const processedContent = this.preprocess(content);

      // 2. Calculate various metrics
      // const metrics = this.calculateMetrics(processedContent);

      // 3. Combine metrics into a final score
      // calculatedScore = this.combineMetrics(metrics);

      // 4. Normalize the score (0-100 range)
      const normalizedScore = this.normalize(calculatedScore);

      // 5. Apply scorer weight
      const weightedScore = this.applyWeight(normalizedScore);

      // 6. Return result with metrics
      return {
        rawScore: calculatedScore,
        normalizedScore: weightedScore,
        metrics: {
          // Add your specific metrics here
        },
      };

    } catch (error) {
      console.error(`Error in ${this.id}:`, error);
      return {
        rawScore: 0,
        normalizedScore: 0,
        metrics: {},
      };
    }
  }

  /**
   * Helper methods for your scoring logic
   */

  /*
  private preprocess(content: string): string {
    // Add content preprocessing logic
    return content;
  }

  private calculateMetrics(content: string): Record<string, number> {
    // Add metrics calculation logic
    return {};
  }

  private combineMetrics(metrics: Record<string, number>): number {
    // Add logic to combine metrics into a final score
    return 0;
  }
  */
}
