import { CloudEvent } from "../../core/cloud-events";
import { Module } from "../../core/module-base";
import { CommentData, CommentProcessorConfig, ProcessedComment } from "./types";

export abstract class BaseCommentProcessor implements Module<CommentData, ProcessedComment> {
  name: string;
  supportedEventTypes: string[];
  protected config: Required<CommentProcessorConfig>;

  constructor(name: string, supportedEvents: string[], config: CommentProcessorConfig = {}) {
    this.name = name;
    this.supportedEventTypes = supportedEvents;
    this.config = {
      minLength: config.minLength ?? 0,
      excludeBots: config.excludeBots ?? false,
      excludeUsers: config.excludeUsers ?? [],
      filterPatterns: config.filterPatterns ?? [],
    };
  }

  canProcess(event: CloudEvent<any>): boolean {
    return this.supportedEventTypes.includes(event.type);
  }

  async transform(event: CloudEvent<any>, result: ProcessedComment): Promise<ProcessedComment> {
    const commentData: CommentData = {
      id: event.data.comment?.id || event.data.id,
      body: event.data.comment?.body || event.data.body,
      user: event.data.comment?.user || event.data.user,
    };
    return this.process(commentData);
  }

  protected validateComment(comment: CommentData): ProcessedComment {
    const processed: ProcessedComment = {
      ...comment,
      isValid: true,
    };

    // Skip if comment is too short
    if (comment.body.length < this.config.minLength) {
      processed.isValid = false;
      processed.invalidReason = `Comment length (${comment.body.length}) is less than minimum (${this.config.minLength})`;
      return processed;
    }

    // Skip bot comments if configured
    if (this.config.excludeBots && comment.user?.type === "Bot") {
      processed.isValid = false;
      processed.invalidReason = "Bot comments are excluded";
      return processed;
    }

    // Skip excluded users
    if (comment.user?.login && this.config.excludeUsers.includes(comment.user.login)) {
      processed.isValid = false;
      processed.invalidReason = `User ${comment.user.login} is excluded`;
      return processed;
    }

    // Check against filter patterns
    for (const pattern of this.config.filterPatterns) {
      if (pattern.test(comment.body)) {
        processed.isValid = false;
        processed.invalidReason = `Comment matches excluded pattern: ${pattern}`;
        return processed;
      }
    }

    return processed;
  }

  public process(comment: CommentData): ProcessedComment {
    const validatedComment = this.validateComment(comment);
    if (!validatedComment.isValid) {
      return validatedComment;
    }

    return this.processValidComment(validatedComment);
  }

  protected abstract processValidComment(comment: ProcessedComment): ProcessedComment;
}
