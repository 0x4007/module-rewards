import { CloudEvent } from "../utils/cloud-events";

/**
 * Base configuration interface for all scorers
 */
export interface BaseScorerConfig {
  /**
   * Weight to apply to this scorer's results (0-1)
   * Default: 1.0
   */
  weight?: number;

  /**
   * Enable debug output
   */
  debug?: boolean;
}

/**
 * Base result interface for all scorers
 */
export interface ScorerResult {
  /**
   * Raw score from the scorer (0-100)
   */
  rawScore: number;

  /**
   * Normalized score (0-1)
   */
  normalizedScore: number;

  /**
   * Additional metrics specific to this scorer
   */
  metrics?: Record<string, any>;
}

/**
 * Base class for implementing scoring strategies
 */
export abstract class BaseScorer<TConfig extends BaseScorerConfig = BaseScorerConfig> {
  protected config: TConfig;

  constructor(config: TConfig) {
    this.config = {
      weight: 1.0,
      debug: false,
      ...config,
    };
  }

  /**
   * Unique identifier for this scorer type
   */
  abstract get id(): string;

  /**
   * Score the provided content
   */
  abstract score(content: string): Promise<ScorerResult>;

  /**
   * Extract scorable content from a cloud event
   */
  protected extractContent(event: CloudEvent, result: Record<string, any>): string | undefined {
    // First check if content was already extracted
    if (result.content && typeof result.content === "string") {
      return result.content;
    }

    // Extract from common event data locations
    const data = event.data as any;
    return (
      data?.comment?.body ||
      data?.issue?.body ||
      data?.pull_request?.body ||
      data?.content ||
      data?.body ||
      data?.text
    );
  }

  /**
   * Apply weight to a normalized score
   */
  protected applyWeight(score: number): number {
    return score * (this.config.weight || 1.0);
  }

  /**
   * Normalize a raw score to 0-1 range
   */
  protected normalize(raw: number, min = 0, max = 100): number {
    if (raw >= max) return 1.0;
    if (raw <= min) return 0.0;
    return (raw - min) / (max - min);
  }
}
