import { CloudEvent } from "../utils/cloud-events";

/**
 * Interface for platform-specific adapters
 * Each adapter is responsible for normalizing platform events to CloudEvents
 */
export interface PlatformAdapter {
  /**
   * The name of the platform this adapter handles
   */
  readonly platformName: string;

  /**
   * Supported event types by this adapter
   */
  readonly supportedEventTypes: string[];

  /**
   * Normalize a platform-specific event into CloudEvents format
   * @param eventType The type of the event (platform-specific)
   * @param payload The raw event payload
   * @returns A normalized CloudEvent
   */
  normalizeEvent(eventType: string, payload: unknown): CloudEvent;

  /**
   * Validate an incoming webhook payload
   * @param headers The webhook request headers
   * @param payload The webhook payload
   * @returns Whether the payload is valid
   */
  validateWebhook(headers: Record<string, string>, payload: unknown): boolean;
}

/**
 * Base adapter implementation with common functionality
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platformName: string;
  abstract readonly supportedEventTypes: string[];

  /**
   * Normalize a platform-specific event into CloudEvents format
   */
  abstract normalizeEvent(eventType: string, payload: unknown): CloudEvent;

  /**
   * Validate an incoming webhook payload
   * Default implementation always returns true
   * Override this in platform-specific adapters to implement validation
   */
  validateWebhook(_headers: Record<string, string>, _payload: unknown): boolean {
    return true;
  }

  /**
   * Convert a platform-specific event type to CloudEvents format
   * @param eventType The platform-specific event type
   */
  protected standardizeEventType(eventType: string): string {
    // Replace spaces with dots, convert to lowercase
    return `com.${this.platformName}.${eventType.toLowerCase().replace(/\s+/g, ".")}`;
  }
}
