import * as textReadability from "../utils/text-readability-shim";
import { BaseScorer, BaseScorerConfig, ScorerResult } from "./base-scorer";

/**
 * Configuration options for the ReadabilityScorer
 */
export interface ReadabilityScorerConfig extends BaseScorerConfig {
  /**
   * Target readability score - scores closer to this value will be normalized higher
   * Default: 60 (standard readable text)
   */
  targetScore?: number;

  /**
   * Whether to include all readability metrics in results
   */
  includeAllMetrics?: boolean;
}

/**
 * Extended result interface for readability scoring
 */
export interface ReadabilityScorerResult extends ScorerResult {
  metrics: {
    fleschReadingEase: number;
    fleschKincaidGrade?: number;
    gunningFogIndex?: number;
    colemanLiauIndex?: number;
    smogIndex?: number;
    automatedReadabilityIndex?: number;
    textStats?: {
      sentences: number;
      words: number;
      syllables: number;
      wordsPerSentence: number;
      syllablesPerWord: number;
    };
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ReadabilityScorerConfig = {
  targetScore: 60,
  weight: 1.0,
  debug: false,
  includeAllMetrics: false,
};

/**
 * Implements readability scoring using the text-readability package
 */
export class ReadabilityScorer extends BaseScorer<ReadabilityScorerConfig> {
  readonly id = "readability";

  constructor(config: Partial<ReadabilityScorerConfig> = {}) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Score content based on readability metrics
   */
  async score(content: string): Promise<ReadabilityScorerResult> {
    const fleschReadingEase = textReadability.fleschReadingEase(content);

    // Calculate normalized score based on distance from target
    const distance = Math.abs(fleschReadingEase - (this.config.targetScore || 60));
    const normalizedScore = this.normalize(100 - distance);
    const weightedScore = this.applyWeight(normalizedScore);

    // Create metrics object
    const metrics: ReadabilityScorerResult["metrics"] = {
      fleschReadingEase,
    };

    // Add additional metrics if requested
    if (this.config.includeAllMetrics) {
      metrics.fleschKincaidGrade = textReadability.fleschKincaidGrade(content);
      metrics.gunningFogIndex = textReadability.gunningFog(content);
      metrics.colemanLiauIndex = textReadability.colemanLiau(content);
      metrics.smogIndex = textReadability.smogIndex(content);
      metrics.automatedReadabilityIndex = textReadability.automatedReadabilityIndex(content);

      metrics.textStats = {
        sentences: textReadability.sentenceCount(content),
        words: textReadability.lexiconCount(content),
        syllables: textReadability.syllableCount(content),
        wordsPerSentence: textReadability.wordsPerSentence(content),
        syllablesPerWord:
          textReadability.syllableCount(content) / textReadability.lexiconCount(content),
      };
    }

    if (this.config.debug) {
      console.log("Readability results:", {
        raw: fleschReadingEase,
        normalized: normalizedScore,
        weighted: weightedScore,
        metrics,
      });
    }

    return {
      rawScore: fleschReadingEase,
      normalizedScore: weightedScore,
      metrics,
    };
  }
}
