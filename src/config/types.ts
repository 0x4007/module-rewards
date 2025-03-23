import { CloudEvent } from "../utils/cloud-events";

/**
 * Configuration for a workflow
 */
export interface WorkflowConfig {
  /**
   * The name of the workflow
   */
  name: string;

  /**
   * Optional description
   */
  description?: string;

  /**
   * Event triggers that activate this workflow
   */
  on: Record<string, Record<string, string[]>>;

  /**
   * Global configuration values
   */
  config?: Record<string, any>;

  /**
   * Modules to execute in this workflow
   */
  modules: ModuleConfig[];
}

/**
 * Configuration for a module in a workflow
 */
export interface ModuleConfig {
  /**
   * The module to use
   */
  uses: string;

  /**
   * Optional identifier for the module
   */
  id?: string;

  /**
   * Conditional expression for when to run this module
   */
  if?: string;

  /**
   * Configuration parameters for the module
   */
  with?: Record<string, any>;
}

/**
 * Matcher for determining if a workflow should handle an event
 */
export interface EventMatcher {
  /**
   * Check if this matcher applies to an event
   */
  matches(event: CloudEvent): boolean;
}

/**
 * Simple event matcher that matches based on event type
 */
export class SimpleEventMatcher implements EventMatcher {
  constructor(
    private readonly platform: string,
    private readonly eventType: string
  ) {}

  matches(event: CloudEvent): boolean {
    // Match based on CloudEvents type
    // Expected format: com.{platform}.{eventType}
    const parts = event.type.split(".");
    if (parts.length < 3) return false;

    const eventPlatform = parts[1];
    const eventAction = parts.slice(2).join(".");

    return eventPlatform === this.platform && eventAction === this.eventType;
  }
}
