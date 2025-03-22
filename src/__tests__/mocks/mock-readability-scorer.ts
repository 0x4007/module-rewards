import { BaseModule } from "../../core/module-base";
import { CloudEvent } from "../../utils/cloud-events";

/**
 * Mock readability result for testing
 */
export const MOCK_READABILITY_RESULT = {
  fleschReadingEase: 70.5,
  fleschKincaidGrade: 8.2,
  gunningFogIndex: 10.5,
  colemanLiauIndex: 9.3,
  smogIndex: 8.7,
  automatedReadabilityIndex: 9.5,
  normalizedScore: 0.8,
  textStats: {
    sentences: 5,
    words: 50,
    syllables: 75,
    wordsPerSentence: 10,
    syllablesPerWord: 1.5,
  },
};

/**
 * Mock implementation of ReadabilityScorer for testing
 * This avoids having to mock the text-readability package
 */
export class MockReadabilityScorer extends BaseModule<any, Record<string, any>> {
  readonly name = "readability-scorer";
  readonly supportedEventTypes = /.*/;

  constructor(config: any = {}) {
    super(config);
  }

  /**
   * Mock transform method for testing
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

    // Create mock readability result
    const readabilityResult = {
      ...MOCK_READABILITY_RESULT,
      // Adjust normalized score based on target score proximity
      normalizedScore: this.config.targetScore === 70.5 ? 1.0 : 0.8,
    };

    // Apply weight
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
}
