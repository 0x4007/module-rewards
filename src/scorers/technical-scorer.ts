import { BaseScorer, BaseScorerConfig, ScorerResult } from "./base-scorer";

/**
 * Configuration for technical scoring
 */
export interface TechnicalScorerConfig extends BaseScorerConfig {
  /**
   * Weighted importance of different technical aspects (0-1)
   */
  weights?: {
    codeBlockQuality?: number;
    technicalTerms?: number;
    explanationQuality?: number;
  };
}

/**
 * Extended result interface for technical scoring
 */
export interface TechnicalScorerResult extends ScorerResult {
  metrics: {
    codeBlockScore: number;
    technicalTermScore: number;
    explanationScore: number;
    codeBlockCount: number;
    technicalTermCount: number;
    explanationLines: number;
  };
}

// Default weights for different aspects
const DEFAULT_WEIGHTS = {
  codeBlockQuality: 0.4,
  technicalTerms: 0.3,
  explanationQuality: 0.3,
};

/**
 * Technical terms to look for (example list)
 */
const TECHNICAL_TERMS = new Set([
  "api",
  "async",
  "await",
  "function",
  "class",
  "interface",
  "type",
  "const",
  "let",
  "var",
  "import",
  "export",
  "return",
  "promise",
  "callback",
  "parameter",
  "argument",
  "method",
  "property",
  "object",
  "array",
  "string",
  "number",
  "boolean",
  "null",
  "undefined",
  "try",
  "catch",
  "throw",
  "error",
]);

/**
 * Scores content based on technical quality metrics
 */
export class TechnicalScorer extends BaseScorer<TechnicalScorerConfig> {
  readonly id = "technical";
  private weights: typeof DEFAULT_WEIGHTS;

  constructor(config: TechnicalScorerConfig = {}) {
    super(config);
    this.weights = { ...DEFAULT_WEIGHTS, ...config.weights };
  }

  async score(content: string): Promise<TechnicalScorerResult> {
    // Extract code blocks and calculate their quality
    const { codeBlocks, remainingText } = this.extractCodeBlocks(content);
    const codeBlockMetrics = this.analyzeCodeBlocks(codeBlocks);

    // Analyze technical terms usage
    const technicalTermMetrics = this.analyzeTechnicalTerms(remainingText);

    // Analyze explanation quality
    const explanationMetrics = this.analyzeExplanationQuality(remainingText);

    // Calculate component scores
    const codeBlockScore = this.normalize(codeBlockMetrics.quality * 100);
    const technicalTermScore = this.normalize(technicalTermMetrics.quality * 100);
    const explanationScore = this.normalize(explanationMetrics.quality * 100);

    // Calculate weighted total score
    const weightedScore =
      codeBlockScore * this.weights.codeBlockQuality +
      technicalTermScore * this.weights.technicalTerms +
      explanationScore * this.weights.explanationQuality;

    // Prepare metrics
    const metrics = {
      codeBlockScore,
      technicalTermScore,
      explanationScore,
      codeBlockCount: codeBlockMetrics.count,
      technicalTermCount: technicalTermMetrics.count,
      explanationLines: explanationMetrics.lines,
    };

    if (this.config.debug) {
      console.log("Technical scoring metrics:", metrics);
    }

    return {
      rawScore: weightedScore * 100,
      normalizedScore: this.applyWeight(weightedScore),
      metrics,
    };
  }

  /**
   * Extract code blocks from content
   */
  private extractCodeBlocks(content: string): {
    codeBlocks: string[];
    remainingText: string;
  } {
    const codeBlocks: string[] = [];
    const codeBlockRegex = /```[\s\S]*?```/g;
    const remainingText = content.replace(codeBlockRegex, (match) => {
      codeBlocks.push(match);
      return "";
    });

    return { codeBlocks, remainingText };
  }

  /**
   * Analyze code blocks for quality metrics
   */
  private analyzeCodeBlocks(codeBlocks: string[]): {
    quality: number;
    count: number;
  } {
    if (codeBlocks.length === 0) {
      return { quality: 0, count: 0 };
    }

    let totalQuality = 0;
    for (const block of codeBlocks) {
      // Remove markdown code fence
      const code = block.replace(/```.*\n?/g, "").trim();

      // Calculate quality based on various factors
      let quality = 0;

      // Check for proper indentation
      const hasProperIndentation = /^[ ]{2,}|\t/m.test(code);
      if (hasProperIndentation) quality += 0.3;

      // Check for comments
      const hasComments = /\/\/|\/\*|\*/m.test(code);
      if (hasComments) quality += 0.2;

      // Check for reasonable line length
      const lines = code.split("\n");
      const reasonableLength = lines.every((line) => line.length <= 80);
      if (reasonableLength) quality += 0.2;

      // Check for consistent naming
      const hasCamelCase = /[a-z][A-Z][a-z]/m.test(code);
      if (hasCamelCase) quality += 0.3;

      totalQuality += quality;
    }

    return {
      quality: totalQuality / codeBlocks.length,
      count: codeBlocks.length,
    };
  }

  /**
   * Analyze technical term usage
   */
  private analyzeTechnicalTerms(text: string): {
    quality: number;
    count: number;
  } {
    const words = text.toLowerCase().split(/\W+/);
    const technicalWords = words.filter((word) => TECHNICAL_TERMS.has(word));

    // Calculate quality based on term density and variety
    const uniqueTerms = new Set(technicalWords);
    const termDensity = technicalWords.length / words.length;
    const termVariety = uniqueTerms.size / TECHNICAL_TERMS.size;

    return {
      quality: (termDensity + termVariety) / 2,
      count: technicalWords.length,
    };
  }

  /**
   * Analyze explanation quality
   */
  private analyzeExplanationQuality(text: string): {
    quality: number;
    lines: number;
  } {
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    const totalLines = lines.length;

    if (totalLines === 0) {
      return { quality: 0, lines: 0 };
    }

    // Calculate quality based on various factors
    let quality = 0;

    // Check for section headers
    const hasSections = lines.some((line) => /^#{2,}\s+\w+/.test(line));
    if (hasSections) quality += 0.2;

    // Check for bullet points
    const hasBullets = lines.some((line) => /^[-*]\s+\w+/.test(line));
    if (hasBullets) quality += 0.2;

    // Check for reasonable paragraph lengths (3-10 lines)
    const paragraphs = text.split(/\n\s*\n/);
    const goodParagraphs = paragraphs.filter(
      (p) => p.split("\n").length >= 3 && p.split("\n").length <= 10
    );
    quality += 0.3 * (goodParagraphs.length / paragraphs.length);

    // Check for examples (indicated by "for example", "e.g.", etc.)
    const hasExamples = /for example|e\.g\.|i\.e\.|such as/.test(text.toLowerCase());
    if (hasExamples) quality += 0.3;

    return {
      quality,
      lines: totalLines,
    };
  }
}
