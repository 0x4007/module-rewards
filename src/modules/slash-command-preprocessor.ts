/**
 * SlashCommandPreprocessor Module
 *
 * This module detects and flags comments that start with slash commands (e.g. "/help", "/command").
 * These comments will be excluded from scoring to prevent skewing metrics on conversational quality.
 */

import { BaseModule } from "../core/module-base";
import { CloudEvent } from "../utils/cloud-events";

/**
 * Configuration for the SlashCommandPreprocessor module
 */
export interface SlashCommandPreprocessorConfig {
  /**
   * Whether to also filter commands that have whitespace before the slash
   * (e.g. " /command")
   */
  ignoreLeadingWhitespace?: boolean;

  /**
   * Specific slash commands to exclude from filtering (they will be scored normally)
   * For example, you might want to still score comments that start with "/feedback"
   */
  excludeCommands?: string[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: SlashCommandPreprocessorConfig = {
  ignoreLeadingWhitespace: true,
  excludeCommands: []
};

/**
 * SlashCommandPreprocessor - Identifies comments that start with slash commands
 * and flags them to be excluded from scoring metrics.
 */
export class SlashCommandPreprocessor extends BaseModule<SlashCommandPreprocessorConfig, Record<string, any>> {
  readonly name = "slash-command-preprocessor";
  readonly supportedEventTypes = /com\.(github|google-docs|telegram)\..*/;

  constructor(config: SlashCommandPreprocessorConfig = {}) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Process an event to check if it contains a slash command
   */
  async transform(event: CloudEvent, result: Record<string, any>): Promise<Record<string, any>> {
    // If we've already filtered this content, don't process again
    if (result.filtered === true) {
      return result;
    }

    // Extract the content from the event or previous results
    const content = this.extractContent(event, result);

    // If we couldn't extract content, return unchanged
    if (!content) {
      return { ...result, isSlashCommand: false };
    }

    // Check if the content starts with a slash command
    const isSlashCommand = this.isSlashCommand(content);

    // Return the result with the slash command flag
    return {
      ...result,
      isSlashCommand,
      // Keep the original content for display purposes
      content,
    };
  }

  /**
   * Extract content from an event or previous result
   */
  private extractContent(event: CloudEvent, result: Record<string, any>): string | undefined {
    // First check if content was already extracted by a previous module
    if (result.content) {
      return result.content;
    }

    const data = event.data as any;

    // Extract content based on event type - similar to ContentFilter module
    // GitHub issue comment
    if (event.type.includes("github.issue_comment")) {
      return data?.comment?.body;
    }

    // GitHub issue
    if (event.type.includes("github.issues")) {
      return data?.issue?.body;
    }

    // GitHub pull request
    if (event.type.includes("github.pull_request")) {
      return data?.pull_request?.body;
    }

    // Google Docs document
    if (event.type.includes("google-docs.document")) {
      return data?.document?.content;
    }

    // Telegram message
    if (event.type.includes("telegram.message")) {
      return data?.message?.text;
    }

    // Default fallback - try some common patterns
    return data?.content || data?.body || data?.text;
  }

  /**
   * Determine if content starts with a slash command
   */
  private isSlashCommand(content: string): boolean {
    if (!content) return false;

    let trimmedContent = content;

    // If configured to ignore leading whitespace, trim the content
    if (this.config.ignoreLeadingWhitespace) {
      trimmedContent = content.trimStart();
    }

    // Check if it starts with a slash
    if (!trimmedContent.startsWith('/')) {
      return false;
    }

    // If it starts with a slash, extract the command
    const match = trimmedContent.match(/^\/(\w+)/);
    if (!match) return true; // It's a slash with no command, still count as slash command

    const command = match[1];

    // Check if this command is in the exclude list
    if (this.config.excludeCommands?.includes(command)) {
      return false; // Don't treat excluded commands as slash commands
    }

    return true;
  }
}
