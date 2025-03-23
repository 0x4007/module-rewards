/**
 * Comment Grouping - Utility functions for detecting and grouping consecutive comments from the same user
 * This helps with scoring calculations to prevent gaming the system with multiple short comments
 */
import { GitHubComment } from "./types";

/**
 * Configuration options for comment grouping
 */
export interface CommentGroupingOptions {
  /** Whether to enable comment grouping (default: true) */
  enabled?: boolean;
}

/**
 * Default options for comment grouping
 */
const DEFAULT_OPTIONS: CommentGroupingOptions = {
  enabled: true,
};

/**
 * A group of consecutive comments from the same user
 */
export interface CommentGroup {
  /** The user who posted the comments */
  user: string;
  /** The source/context of the comments */
  source: string;
  /** The comment IDs in this group */
  commentIds: (string | number)[];
  /** The combined text of all comments in the group */
  combinedText: string;
  /** The total word count of all comments in the group */
  totalWordCount: number;
}

/**
 * Maps comment IDs to their group
 */
export interface CommentGroupMap {
  [commentId: string]: CommentGroup;
}

/**
 * Detects and groups consecutive comments from the same user within the same context
 * @param comments The list of comments to group
 * @param section The section these comments belong to (pr or issue)
 * @param options Configuration options
 * @returns A map of comment IDs to their groups
 */
export function detectConsecutiveComments(
  comments: GitHubComment[],
  section: "pr" | "issue",
  options: CommentGroupingOptions = {}
): CommentGroupMap {
  // Merge with default options
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // If grouping is disabled, return an empty map
  if (!opts.enabled) {
    return {};
  }

  // Ensure comments are sorted by creation date
  const sortedComments = [...comments].sort((a, b) => {
    return new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime();
  });

  const groups: CommentGroup[] = [];
  const groupMap: CommentGroupMap = {};

  // Process all comments
  let currentGroup: CommentGroup | null = null;

  for (const comment of sortedComments) {
    // Skip comments without a user or body
    if (!comment.user?.login || !comment.body) {
      continue;
    }

    const currentUser = comment.user.login;

    // Check if the comment has any source-specific properties
    const commentSource = getCommentSource(comment, section);

    // Check if this comment continues the current group (same user and same source)
    const isSameUser = currentGroup && currentGroup.user === currentUser;
    const isSameSource = currentGroup && currentGroup.source === commentSource;

    if (isSameUser && isSameSource && currentGroup) {
      // Continue the current group
      currentGroup.commentIds.push(comment.id);
      currentGroup.combinedText += "\n\n" + comment.body;
      currentGroup.totalWordCount += countWordsInText(comment.body);
    } else {
      // Start a new group
      currentGroup = {
        user: currentUser,
        source: getCommentSource(comment, section),
        commentIds: [comment.id],
        combinedText: comment.body,
        totalWordCount: countWordsInText(comment.body),
      };
      groups.push(currentGroup);
    }

    // No need to track comment time anymore
  }

  // Map each comment ID to its group
  for (const group of groups) {
    // Only create group entries for comments that are part of multi-comment groups
    if (group.commentIds.length > 1) {
      for (const id of group.commentIds) {
        groupMap[String(id)] = group;
      }
    }
  }

  return groupMap;
}

/**
 * Determines the source context of a comment
 * @param comment The comment to analyze
 * @param section The section (pr or issue) this comment belongs to
 * @returns A string identifier for the comment's source/context
 */
function getCommentSource(comment: GitHubComment, section: "pr" | "issue"): string {
  // Start with the section as the base source
  let source = section;

  // Add more specific context if available
  if (comment.path) {
    // This is a file-specific PR review comment
    source += `:review:${comment.path}`;
  } else if (comment.pull_request_url) {
    // This is a PR conversation comment
    source += `:conversation`;
  } else if (comment.commit_id) {
    // This is a commit-specific comment
    source += `:commit:${comment.commit_id}`;
  }

  return source;
}

/**
 * Helper function to count words in text
 * This is a simplified version - the full logic would use the same implementation as in scoring-utils.ts
 */
function countWordsInText(text: string): number {
  if (!text || typeof text !== "string") return 0;

  // A simple word count for this helper
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}
