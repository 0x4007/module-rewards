/**
 * Comment Grouping - Utility functions for detecting and grouping consecutive comments from the same user
 * This helps with scoring calculations to prevent gaming the system with multiple short comments
 */
import { GitHubComment } from "./types";
import { isGitHubBot } from "./utils/github-utils";

/**
 * Checks if a comment is a slash command (starts with /)
 * @param comment The comment to check
 * @returns True if the comment is a slash command
 */
function isSlashCommand(comment: GitHubComment): boolean {
  if (!comment.body) return false;

  // Trim the content and check if it starts with a slash
  const trimmedContent = comment.body.trimStart();
  return trimmedContent.startsWith('/');
}

/**
 * Configuration options for comment grouping
 */
interface CommentGroupingOptions {
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

  // Special IDs for PR/issue body comments that should always be processed first
  const bodyCommentIds = [0, -3];

  // Sort comments: PR/issue body first, then by creation date
  const sortedComments = [...comments].sort((a, b) => {
    // If a is a PR/issue body comment and b is not, a comes first
    if (bodyCommentIds.includes(a.id as number) && !bodyCommentIds.includes(b.id as number)) {
      return -1;
    }

    // If b is a PR/issue body comment and a is not, b comes first
    if (bodyCommentIds.includes(b.id as number) && !bodyCommentIds.includes(a.id as number)) {
      return 1;
    }

    // Otherwise sort by creation date
    return new Date(a.created_at || "").getTime() - new Date(b.created_at || "").getTime();
  });

  const groups: CommentGroup[] = [];
  const groupMap: CommentGroupMap = {};

  // Process all comments
  let currentGroup: CommentGroup | null = null;

  for (const comment of sortedComments) {
    // Skip comments without a user or body, or if from a bot
    if (!comment.user?.login || !comment.body || isGitHubBot(comment.user)) {
      continue;
    }

    const currentUser = comment.user.login;

    // Check if the comment has any source-specific properties
    const commentSource = getCommentSource(comment, section);

    // Check if this is a PR/issue body comment (special IDs 0 or -3)
    const isPROrIssueBody = bodyCommentIds.includes(comment.id as number);

    // Check if this comment continues the current group (same user and same source)
    const isSameUser = currentGroup && currentGroup.user === currentUser;
    const isSameSource = currentGroup && currentGroup.source === commentSource;
    const isCurrentOrNextBot = isGitHubBot(comment.user);
    const isCurrentOrNextSlashCommand = isSlashCommand(comment);

    // Never group PR/issue body comments, slash commands, or bot comments with other comments, even from the same author
    if (!isPROrIssueBody && isSameUser && isSameSource && currentGroup &&
        !isCurrentOrNextBot && !isCurrentOrNextSlashCommand) {
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
      // and where the user is not a bot and none of the comments are slash commands
      const noSlashCommands = !group.commentIds.some(id => {
        const comment = sortedComments.find(c => c.id === id);
        return comment && isSlashCommand(comment);
      });

      if (group.commentIds.length > 1 &&
          !isGitHubBot({ login: group.user } as GitHubComment["user"]) &&
          noSlashCommands) {
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
