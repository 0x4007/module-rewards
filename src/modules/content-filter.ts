import { BaseModule } from '../core/module-base';
import { CloudEvent } from '../utils/cloud-events';

/**
 * Configuration for the ContentFilter module
 */
export interface ContentFilterConfig {
  /**
   * Whether to exclude bots from processing
   */
  excludeBots?: boolean;

  /**
   * Minimum content length to process
   */
  minLength?: number;

  /**
   * List of user IDs to exclude
   */
  excludeUsers?: string[];

  /**
   * Regular expression patterns to match content that should be filtered
   */
  filterPatterns?: string[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ContentFilterConfig = {
  excludeBots: true,
  minLength: 10,
  excludeUsers: [],
  filterPatterns: []
};

/**
 * Filters content based on configurable rules
 * Inspired by the original DataPurgeModule
 */
export class ContentFilter extends BaseModule<ContentFilterConfig, Record<string, any>> {
  readonly name = 'content-filter';
  // Use a single regex that matches all supported types
  readonly supportedEventTypes = /com\.(github|google-docs|telegram)\..*/;

  constructor(config: ContentFilterConfig = {}) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Apply content filtering rules to an event
   */
  async transform(event: CloudEvent, result: Record<string, any>): Promise<Record<string, any>> {
    // If we've already filtered this content in a previous run, don't process again
    if (result.filtered === true) {
      return result;
    }

    // Extract the content and author from the event data
    // This will vary based on the event type, so we need to handle different formats
    const { content, author } = this.extractContentAndAuthor(event);

    // If we couldn't extract content, return unchanged
    if (!content) {
      return { ...result, filtered: false, reason: 'no-content' };
    }

    // Apply filtering rules
    const filterResult = this.applyFilterRules(content, author);

    // If content is filtered, return the filter result
    if (filterResult.filtered) {
      return {
        ...result,
        filtered: true,
        reason: filterResult.reason
      };
    }

    // Content passed all filters, return with filtered=false
    return {
      ...result,
      filtered: false,
      content,
      author
    };
  }

  /**
   * Extract content and author from various event types
   */
  private extractContentAndAuthor(event: CloudEvent): { content?: string; author?: string } {
    const data = event.data as any;

    // GitHub issue comment
    if (event.type.includes('github.issue_comment')) {
      return {
        content: data?.comment?.body,
        author: data?.comment?.user?.login
      };
    }

    // GitHub issue
    if (event.type.includes('github.issues')) {
      return {
        content: data?.issue?.body,
        author: data?.issue?.user?.login
      };
    }

    // GitHub pull request
    if (event.type.includes('github.pull_request')) {
      return {
        content: data?.pull_request?.body,
        author: data?.pull_request?.user?.login
      };
    }

    // Google Docs document
    if (event.type.includes('google-docs.document')) {
      return {
        content: data?.document?.content,
        author: data?.document?.author
      };
    }

    // Telegram message
    if (event.type.includes('telegram.message')) {
      return {
        content: data?.message?.text,
        author: data?.message?.from?.username
      };
    }

    // Default fallback - try some common patterns
    return {
      content: data?.content || data?.body || data?.text,
      author: data?.author || data?.user?.login || data?.sender?.login
    };
  }

  /**
   * Apply filtering rules to content
   */
  private applyFilterRules(content: string, author?: string): { filtered: boolean; reason?: string } {
    // Check for bot if excludeBots is enabled
    if (this.config.excludeBots && author && this.isBot(author)) {
      return { filtered: true, reason: 'bot-author' };
    }

    // Check minimum length
    if (this.config.minLength && content.length < this.config.minLength) {
      return { filtered: true, reason: 'too-short' };
    }

    // Check excluded users
    if (author && this.config.excludeUsers?.includes(author)) {
      return { filtered: true, reason: 'excluded-user' };
    }

    // Check filter patterns
    if (this.config.filterPatterns?.length) {
      for (const pattern of this.config.filterPatterns) {
        if (new RegExp(pattern, 'i').test(content)) {
          return { filtered: true, reason: 'matched-pattern' };
        }
      }
    }

    // Content passed all filters
    return { filtered: false };
  }

  /**
   * Simple check to identify if an author is a bot
   * This can be enhanced with platform-specific logic
   */
  private isBot(author: string): boolean {
    return author.endsWith('[bot]') || author.toLowerCase().includes('bot');
  }
}
