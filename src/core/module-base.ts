import { CloudEvent } from "../utils/cloud-events";

/**
 * The base interface that all modules must implement
 */
export interface Module<TConfig = any, TResult = any> {
  /**
   * The name of the module
   */
  readonly name: string;

  /**
   * Event types this module can process
   */
  readonly supportedEventTypes: string[] | RegExp;

  /**
   * Process an event and return result
   */
  transform(event: CloudEvent, result: TResult): Promise<TResult>;

  /**
   * Check if this module can process the given event
   */
  canProcess(event: CloudEvent): boolean;
}

/**
 * Base implementation that modules can extend
 */
export abstract class BaseModule<TConfig = any, TResult = any> implements Module<TConfig, TResult> {
  abstract readonly name: string;
  abstract readonly supportedEventTypes: string[] | RegExp;

  constructor(protected config: TConfig) {}

  canProcess(event: CloudEvent): boolean {
    if (Array.isArray(this.supportedEventTypes)) {
      return this.supportedEventTypes.includes(event.type);
    }
    return this.supportedEventTypes.test(event.type);
  }

  abstract transform(event: CloudEvent, result: TResult): Promise<TResult>;
}
