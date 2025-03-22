import { CommentScores } from "./types";

/**
 * Counts words in a text, excluding code blocks, URLs, etc.
 */
export function countWords(text: string): number {
  // Skip if text is empty
  if (!text || typeof text !== "string") return 0;

  // Remove block quotes (lines starting with >)
  let cleanedText = text.replace(/^>.*(?:\r?\n|$)/gm, "");

  // Remove code blocks
  cleanedText = cleanedText.replace(/```[\s\S]*?```/g, "");

  // Remove inline code
  cleanedText = cleanedText.replace(/`[^`]+`/g, "");

  // Remove URLs
  cleanedText = cleanedText.replace(/https?:\/\/\S+/g, "");

  // Count words (non-empty strings after splitting by whitespace)
  return cleanedText
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Calculates the original score based on power-law (0.85 exponent)
 */
export function calculateOriginalScore(wordCount: number): number {
  return Math.pow(wordCount, 0.85);
}

/**
 * Calculates the log-adjusted score which balances length
 */
export function calculateLogAdjustedScore(wordCount: number): number {
  return Math.pow(wordCount, 0.85) * (1 / Math.log2(wordCount + 2));
}

/**
 * Calculates the exponential score which penalizes verbosity
 */
export function calculateExponentialScore(wordCount: number): number {
  return Math.pow(wordCount, 0.85) * Math.exp(-wordCount / 100);
}

/**
 * Calculates all scoring metrics for a given text
 */
export function calculateAllScores(text: string): CommentScores {
  const wordCount = countWords(text);
  return {
    wordCount,
    original: calculateOriginalScore(wordCount),
    logAdjusted: calculateLogAdjustedScore(wordCount),
    exponential: calculateExponentialScore(wordCount),
  };
}
