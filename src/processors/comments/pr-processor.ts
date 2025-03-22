import { ProcessedComment } from "./types";
import { BaseCommentProcessor } from "./base-processor";

export class PRCommentProcessor extends BaseCommentProcessor {
  constructor(config = {}) {
    super(
      "github-pr-comment-processor",
      [
        "github.pull_request_review.submitted",
        "github.pull_request_review_comment.created",
        "github.pull_request_review_comment.edited"
      ],
      config
    );
  }

  protected processValidComment(comment: ProcessedComment): ProcessedComment {
    // Add any PR-specific processing here
    // For example, we could add special handling for review comments
    // For now, we just pass through valid comments
    return {
      ...comment,
      isValid: true,
    };
  }
}
