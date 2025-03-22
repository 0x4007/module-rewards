/**
 * BotCommentPreprocessor Module
 *
 * This module detects and flags comments from bot accounts.
 * These comments will be excluded from scoring to prevent skewing metrics from automated messages.
 */

import { BaseModule } from "../core/module-base";
import { CloudEvent } from "../utils/cloud-events";

/**
 * Configuration for the BotCommentPreprocessor module
 */
export interface BotCommentPreprocessorConfig {
  /**
   * Additional bot usernames to detect (beyond standard [bot] suffix detection)
   */
  additionalBotNames?: string[];

  /**
   * Bot usernames to exclude from filtering (they will be scored normally)
   */
  excludeBots?: string[];

  /**
   * Whether to check for the GitHub "bot" property in user objects
   */
  checkGitHubBotProperty?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BotCommentPreprocessorConfig = {
  additionalBotNames: ["dependabot", "renovate", "github-actions"],
  excludeBots: [],
  checkGitHubBotProperty: true
};

/**
 * BotCommentPreprocessor - Identifies comments from bot accounts
 * and flags them to be excluded from scoring metrics.
 */
export class BotCommentPreprocessor extends BaseModule<BotCommentPreprocessorConfig, Record<string, any>> {
  readonly name = "bot-comment-preprocessor";
  readonly supportedEventTypes = /com\.(github|google-docs|telegram)\..*/;

  constructor(config: BotCommentPreprocessorConfig = {}) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Process an event to check if it contains a comment from a bot
   */
  async transform(event: CloudEvent, result: Record<string, any>): Promise<Record<string, any>> {
    // If we've already filtered this content, don't process again
    if (result.filtered === true) {
      return result;
    }

    // Extract the author from the event or previous results
    const author = this.extractAuthor(event, result);

    // If we couldn't extract author, return unchanged
    if (!author) {
      return { ...result, isBot: false };
    }

    // Check if the author is a bot
    const isBot = this.isBotAuthor(author, event);

    // Return the result with the bot flag
    return {
      ...result,
      isBot,
      // Keep other properties that might have been set by other modules
      author,
    };
  }

  /**
   * Extract author from an event or previous result
   */
  private extractAuthor(event: CloudEvent, result: Record<string, any>): string | undefined {
    // First check if author was already extracted by a previous module
    if (result.author) {
      return result.author;
    }

    const data = event.data as any;

    // Extract author based on event type
    // GitHub issue comment
    if (event.type.includes("github.issue_comment")) {
      return data?.comment?.user?.login;
    }

    // GitHub issue
    if (event.type.includes("github.issues")) {
      return data?.issue?.user?.login;
    }

    // GitHub pull request
    if (event.type.includes("github.pull_request")) {
      return data?.pull_request?.user?.login;
    }

    // Google Docs document
    if (event.type.includes("google-docs.document")) {
      return data?.document?.author;
    }

    // Telegram message
    if (event.type.includes("telegram.message")) {
      return data?.message?.from?.username;
    }

    // Default fallback - try some common patterns
    return data?.author || data?.user?.login || data?.sender?.login;
  }

  /**
   * Determine if the author is a bot
   */
  private isBotAuthor(author: string, event: CloudEvent): boolean {
    if (!author) return false;

    // Check if the author has [bot] suffix (standard GitHub bot indicator)
    if (author.endsWith("[bot]")) {
      return !this.isExcludedBot(author);
    }

    // Check for additional bot name patterns
    if (this.config.additionalBotNames?.some(botName =>
      author.toLowerCase().includes(botName.toLowerCase()))) {
      return !this.isExcludedBot(author);
    }

    // Check for GitHub "bot" property if enabled
    if (this.config.checkGitHubBotProperty && this.hasGitHubBotProperty(event)) {
      return !this.isExcludedBot(author);
    }

    return false;
  }

  /**
   * Check if the author is in the excluded bots list
   */
  private isExcludedBot(author: string): boolean {
    return this.config.excludeBots?.some(botName =>
      author.toLowerCase() === botName.toLowerCase()) || false;
  }

  /**
   * Check if the user object has the GitHub bot property set to true
   */
  private hasGitHubBotProperty(event: CloudEvent): boolean {
    const data = event.data as any;

    // Check various possible locations for the bot property
    if (event.type.includes("github")) {
      // Issue comment
      if (data?.comment?.user?.type === "Bot") return true;
      if (data?.comment?.user?.bot === true) return true;

      // Issue
      if (data?.issue?.user?.type === "Bot") return true;
      if (data?.issue?.user?.bot === true) return true;

      // PR
      if (data?.pull_request?.user?.type === "Bot") return true;
      if (data?.pull_request?.user?.bot === true) return true;
    }

    return false;
  }
}
