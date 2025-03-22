import { ProcessedComment } from "./types";
import { BaseCommentProcessor } from "./base-processor";

export class IssueCommentProcessor extends BaseCommentProcessor {
  constructor(config = {}) {
    super(
      "github-issue-comment-processor",
      ["github.issue_comment.created", "github.issue_comment.edited"],
      config
    );
  }

  protected processValidComment(comment: ProcessedComment): ProcessedComment {
    // Add any issue-specific processing here
    // For now, we just pass through valid comments
    return {
      ...comment,
      isValid: true,
    };
  }
}
