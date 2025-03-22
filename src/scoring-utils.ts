import { CommentGroup } from "./comment-grouping";
import { CommentScores } from "./types";

/**
 * Counts words in a text, excluding code blocks, URLs, etc.
 * For slash commands (starting with '/') and bot comments, returns 0 to exclude them from scoring.
 */
export function countWords(text: string, isSlashCommand?: boolean, isBot?: boolean): number {
  // Skip if text is empty
  if (!text || typeof text !== "string") return 0;

  // Skip scoring if this is a slash command or from a bot
  if (isSlashCommand === true || isBot === true) return 0;

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
 * Optionally accepts a commentGroup parameter for handling consecutive comments
 * and flags indicating if the text is a slash command or from a bot
 */
export function calculateAllScores(
  text: string,
  commentGroup?: CommentGroup,
  isSlashCommand?: boolean,
  isBot?: boolean
): CommentScores {
  // Get the word count from the text
  const individualWordCount = countWords(text, isSlashCommand, isBot);

  // If no comment group is provided, or this is a single comment, calculate normally
  if (!commentGroup || commentGroup.commentIds.length <= 1) {
    return {
      wordCount: individualWordCount,
      original: calculateOriginalScore(individualWordCount),
      logAdjusted: calculateLogAdjustedScore(individualWordCount),
      exponential: calculateExponentialScore(individualWordCount),
      isGrouped: false,
    };
  }

  // For grouped comments, calculate scores based on the total word count of the group
  // This ensures that splitting a long comment into multiple short ones doesn't avoid penalties
  const groupWordCount = commentGroup.totalWordCount;

  return {
    wordCount: individualWordCount,
    original: calculateOriginalScore(groupWordCount),
    logAdjusted: calculateLogAdjustedScore(groupWordCount),
    exponential: calculateExponentialScore(groupWordCount),
    groupWordCount,
    isGrouped: true,
  };
}

/**
 * Calculate scores for a comment that might be part of a consecutive group
 * @param text The text of the individual comment
 * @param commentId The comment ID
 * @param groupMap A map of comment IDs to their groups
 * @param isSlashCommand Whether the comment is a slash command
 * @param isBot Whether the comment is from a bot
 * @returns CommentScores object with appropriate scores
 */
export function calculateGroupAwareScores(
  text: string,
  commentId: string | number,
  groupMap: Record<string, CommentGroup>,
  isSlashCommand?: boolean,
  isBot?: boolean
): CommentScores {
  // Get the comment group if this comment is part of one
  const group = groupMap[String(commentId)];

  // Calculate scores (if part of a group, the group's word count will be used)
  return calculateAllScores(text, group, isSlashCommand, isBot);
}
