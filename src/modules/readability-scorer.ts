import { BaseModule } from "../core/module-base";
import { CloudEvent } from "../utils/cloud-events";
// Note: You'll need to install this package with:
// bun add text-readability
import * as textReadability from "text-readability";

/**
 * Configuration options for the ReadabilityScorer module
 */
export interface ReadabilityScorerConfig {
  /**
   * Target readability score - scores closer to this value will be normalized higher
   * Default: 60 (standard readable text)
   */
  targetScore?: number;

  /**
   * Enable debug output for score calculations
   */
  debug?: boolean;

  /**
   * Weight to apply to the readability score (0-1)
   * Default: 1.0
   */
  weight?: number;

  /**
   * Which readability metrics to include in the results
   */
  includeAllMetrics?: boolean;
}

/**
 * Result of a readability analysis
 */
export interface ReadabilityResult {
  /**
   * Flesch Reading Ease score (0-100)
   * Higher scores indicate easier readability
   * - 90-100: Very easy (5th grade)
   * - 80-89: Easy (6th grade)
   * - 70-79: Fairly easy (7th grade)
   * - 60-69: Standard (8th-9th grade)
   * - 50-59: Fairly difficult (10th-12th grade)
   * - 30-49: Difficult (college)
   * - 0-29: Very difficult (college graduate)
   */
  fleschReadingEase: number;

  /**
   * Flesch-Kincaid Grade Level score
   * Corresponds to US grade level required to understand the text
   */
  fleschKincaidGrade?: number;

  /**
   * Gunning Fog Index
   * Years of formal education needed to understand the text
   */
  gunningFogIndex?: number;

  /**
   * Coleman-Liau Index
   * US grade level required to understand the text
   */
  colemanLiauIndex?: number;

  /**
   * SMOG Index
   * Years of education needed to understand the text
   */
  smogIndex?: number;

  /**
   * Automated Readability Index
   * US grade level required to understand the text
   */
  automatedReadabilityIndex?: number;

  /**
   * Normalized score (0-1) based on distance from target score
   * 1.0 = perfect match to target, 0.0 = furthest from target
   */
  normalizedScore: number;

  /**
   * Text statistics from the analyzer
   */
  textStats?: {
    sentences: number;
    words: number;
    syllables: number;
    wordsPerSentence: number;
    syllablesPerWord: number;
  };
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ReadabilityScorerConfig = {
  targetScore: 60,
  debug: false,
  weight: 1.0,
  includeAllMetrics: false,
};

/**
 * Implements readability scoring for text content using the text-readability package
 *
 * This module analyzes text content and calculates readability metrics
 * to determine how easy or difficult the text is to read.
 */
export class ReadabilityScorer extends BaseModule<ReadabilityScorerConfig, Record<string, any>> {
  readonly name = "readability-scorer";

  // This module can process events from any platform with text content
  readonly supportedEventTypes = /.*/;

  constructor(config: ReadabilityScorerConfig = {}) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Process a cloud event and add readability scoring results
   */
  async transform(event: CloudEvent, result: Record<string, any>): Promise<Record<string, any>> {
    // If content was filtered or already has readability score, skip processing
    if (result.filtered === true || result.readability) {
      return result;
    }

    // Extract text content from the event
    const content = this.extractTextContent(event, result);

    // If no content was found, return the result unchanged
    if (!content) {
      if (this.config.debug) {
        console.log("No content found to analyze");
      }
      return result;
    }

    // Calculate readability metrics
    const readabilityResult = this.analyzeReadability(content);

    if (this.config.debug) {
      console.log("Readability results:", readabilityResult);
    }

    // Apply weight to the normalized score
    const weightedScore = readabilityResult.normalizedScore * (this.config.weight || 1.0);

    // Return the result with readability information added
    return {
      ...result,
      readability: readabilityResult,
      weightedReadabilityScore: weightedScore,
    };
  }

  /**
   * Extract text content from a cloud event or intermediate result
   * This handles different event types gracefully
   */
  private extractTextContent(event: CloudEvent, result: Record<string, any>): string | undefined {
    // First check if content was already extracted by a previous module
    if (result.content && typeof result.content === "string") {
      return result.content;
    }

    // Extract based on the event data structure
    const data = event.data as any;

    // Try to find content in common locations
    const content =
      // GitHub specific paths
      data?.comment?.body ||
      data?.issue?.body ||
      data?.pull_request?.body ||
      // Google Docs specific paths
      data?.document?.content ||
      // Telegram specific paths
      data?.message?.text ||
      // Generic fallbacks
      data?.content ||
      data?.body ||
      data?.text;

    return content;
  }

  /**
   * Calculate readability metrics using text-readability package
   */
  private analyzeReadability(text: string): ReadabilityResult {
    // Get Flesch Reading Ease score
    const fleschReadingEase = textReadability.fleschReadingEase(text);

    // Calculate normalized score based on distance from target
    let normalizedScore: number;
    if (fleschReadingEase > 100) {
      normalizedScore = 1.0;
    } else if (fleschReadingEase <= 0) {
      normalizedScore = 0.0;
    } else {
      const distance = Math.abs(fleschReadingEase - (this.config.targetScore || 60));
      normalizedScore = Math.max(0, Math.min(1, (100 - distance) / 100));
    }

    // Create the base result
    const result: ReadabilityResult = {
      fleschReadingEase,
      normalizedScore,
    };

    // Add additional metrics if requested
    if (this.config.includeAllMetrics) {
      // Get more detailed readability metrics
      result.fleschKincaidGrade = textReadability.fleschKincaidGrade(text);
      result.gunningFogIndex = textReadability.gunningFog(text);
      result.colemanLiauIndex = textReadability.colemanLiau(text);
      result.smogIndex = textReadability.smogIndex(text);
      result.automatedReadabilityIndex = textReadability.automatedReadabilityIndex(text);

      // Add text statistics
      result.textStats = {
        sentences: textReadability.sentenceCount(text),
        words: textReadability.lexiconCount(text),
        syllables: textReadability.syllableCount(text),
        wordsPerSentence: textReadability.wordsPerSentence(text),
        syllablesPerWord: textReadability.syllableCount(text) / textReadability.lexiconCount(text),
      };
    }

    return result;
  }
}
