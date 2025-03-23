/**
 * Scoring Utilities - Functions for calculating and processing scores
 */
import { CommentGroupMap } from "./comment-grouping";
import { CommentScores } from "./types";

/**
 * Calculate original score based on a power-law relationship with word count
 * Using a 0.85 exponent provides a reasonable curve that rewards length but not too aggressively
 *
 * @param wordCount Number of words in the content
 * @returns Original score
 */
export function calculateOriginalScore(wordCount: number): number {
  return Math.pow(wordCount, 0.85);
}

/**
 * Calculate log-adjusted score that better balances length consideration
 *
 * @param wordCount Number of words in the content
 * @returns Log-adjusted score
 */
export function calculateLogAdjustedScore(wordCount: number): number {
  return Math.pow(wordCount, 0.85) * (1 / Math.log2(wordCount + 2));
}

/**
 * Calculate exponential score that penalizes verbosity
 *
 * @param wordCount Number of words in the content
 * @returns Exponential score
 */
export function calculateExponentialScore(wordCount: number): number {
  return Math.pow(wordCount, 0.85) * Math.exp(-wordCount / 100);
}

/**
 * Count words in a text, optionally skipping certain types of content
 *
 * @param text Text to count words in
 * @param skipCodeBlocks Whether to skip code blocks
 * @param isBot Whether the content is from a bot
 * @returns Word count
 */
export function countWords(text: string, skipCodeBlocks = true, isBot = false): number {
  // If this is a bot comment or the content is empty, return 0
  if (isBot || !text) {
    return 0;
  }

  // Remove code blocks if required
  const processedText = skipCodeBlocks
    ? text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "")
    : text;

  // Count words (non-empty whitespace-separated tokens)
  return processedText
    .split(/\s+/)
    .filter(token => token.trim().length > 0)
    .length;
}

/**
 * Calculate scores for a comment, taking into account comment grouping
 *
 * @param text Comment text
 * @param commentId Comment ID
 * @param commentGroups Map of comment groups
 * @param isSlashCommand Whether the comment is a slash command
 * @param isBot Whether the comment is from a bot
 * @returns Comment scores
 */
export function calculateGroupAwareScores(
  text: string,
  commentId: number,
  commentGroups: CommentGroupMap,
  isSlashCommand = false,
  isBot = false
): CommentScores {
  const individualWordCount = countWords(text, true, isBot || isSlashCommand);

  // Special case: if it's a slash command or bot, return zero scores
  if (isSlashCommand || isBot) {
    return {
      wordCount: 0,
      original: 0,
      exponential: 0
    };
  }

  // Check if this comment is part of a group
  const groupInfo = commentGroups[String(commentId)];
  if (groupInfo) {
    // Use group word count for scoring if this is the last comment in the group
    const isLastInGroup = groupInfo.commentIds[groupInfo.commentIds.length - 1] === commentId;

    if (isLastInGroup) {
      const groupWordCount = groupInfo.totalWordCount;

      return {
        wordCount: individualWordCount,
        original: calculateOriginalScore(groupWordCount),
        exponential: calculateExponentialScore(groupWordCount),
        isGrouped: true,
        groupWordCount
      };
    } else {
      // For comments in a group that aren't the last one, return minimal scores
      // to avoid double-counting
      return {
        wordCount: individualWordCount,
        original: 0,
        exponential: 0,
        isGrouped: true
      };
    }
  } else {
    // For individual comments not in a group, calculate scores normally
    return {
      wordCount: individualWordCount,
      original: calculateOriginalScore(individualWordCount),
      exponential: calculateExponentialScore(individualWordCount)
    };
  }
}

/**
 * Calculate scores for GitHub users based on their comments
 *
 * @param commentScoreMap Map of comment IDs to their scores
 * @param comments List of GitHub comments
 * @returns Map of usernames to their aggregate scores
 */
export function calculateUserScores(
  commentScoreMap: Map<number, CommentScores>,
  comments: any[]
): Record<string, {
  count: number,
  original: number,
  exponential: number,
  avatar?: string,
  url?: string,
  totalWords: number
}> {
  const userScores: Record<string, {
    count: number;
    original: number;
    exponential: number;
    avatar?: string;
    url?: string;
    totalWords: number;
  }> = {};

  for (const comment of comments) {
    if (!comment.user || !comment.id) continue;

    const scores = commentScoreMap.get(comment.id);
    if (!scores) continue;

    const username = comment.user.login;

    if (!userScores[username]) {
      userScores[username] = {
        count: 0,
        original: 0,
        exponential: 0,
        avatar: comment.user.avatar_url,
        url: comment.user.html_url,
        totalWords: 0
      };
    }

    userScores[username].count++;
    userScores[username].original += scores.original;
    userScores[username].exponential += scores.exponential;
    userScores[username].totalWords += scores.wordCount;
  }

  return userScores;
}
