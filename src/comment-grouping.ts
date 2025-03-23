/**
 * Comment Grouping - Handles the detection and grouping of consecutive comments from the same user
 * This ensures fair scoring by treating consecutive comments as one larger comment
 */
import { GitHubComment } from "./types";

export interface CommentGroup {
  commentIds: number[];
  userId: string;
  totalWordCount: number;
  commentCount: number;
}

export interface CommentGroupMap {
  [commentId: string]: CommentGroup;
}

/**
 * Detect consecutive comments from the same user within the same context
 *
 * This function analyzes a list of comments to identify groups of consecutive comments
 * from the same user. This is important for scoring purposes because we want to score
 * consecutive comments as a single unit to prevent gaming the system by posting multiple
 * short comments instead of one longer comment.
 *
 * @param comments List of GitHub comments to analyze
 * @param context Context type (PR or issue) to ensure we don't group across different contexts
 * @returns Map of comment IDs to their group information
 */
export function detectConsecutiveComments(
  comments: GitHubComment[],
  context: "pr" | "issue"
): CommentGroupMap {
  const groups: CommentGroupMap = {};

  // If less than 2 comments, no grouping needed
  if (!comments || comments.length < 2) {
    return groups;
  }

  // Sort comments by creation date
  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime()
  );

  // Iterate through comments to find consecutive ones from same user
  let currentGroup: CommentGroup | null = null;
  let previousUser: string | null = null;

  for (const comment of sortedComments) {
    const currentUser = comment.user?.login;

    // Skip if no user (should not happen)
    if (!currentUser) {
      continue;
    }

    // If this is the same user as the previous comment, add to current group
    if (currentUser === previousUser && currentGroup) {
      currentGroup.commentIds.push(comment.id);
      currentGroup.commentCount++;

      // Update word count (will be calculated fully later)
      currentGroup.totalWordCount += countWords(comment.body || "");

      // Record this comment as part of the group
      groups[String(comment.id)] = currentGroup;
    } else {
      // Not part of a current group - check if it could start a new group
      // We won't know yet if it's a group until we see the next comment
      currentGroup = {
        commentIds: [comment.id],
        userId: currentUser,
        totalWordCount: countWords(comment.body || ""),
        commentCount: 1
      };
    }

    previousUser = currentUser;
  }

  // Filter out standalone comments (not part of a group)
  for (const id in groups) {
    if (groups[id].commentCount < 2) {
      delete groups[id];
    }
  }

  return groups;
}

/**
 * Simple word count function - counts whitespace-separated tokens
 * Ignores code blocks for more accurate conversational word count
 *
 * @param text Text to count words in
 * @returns Number of words
 */
function countWords(text: string): number {
  if (!text) return 0;

  // Remove code blocks
  const noCodeText = text.replace(/```[\s\S]*?```/g, "");

  // Count words (non-empty whitespace-separated tokens)
  return noCodeText
    .split(/\s+/)
    .filter(token => token.trim().length > 0)
    .length;
}
