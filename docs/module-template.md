# Module Template

This template provides a pattern for creating new modules in the text-conversation-rewards system.
It demonstrates best practices for module structure, configuration, and implementation.

## Usage

1. Copy this template code to `src/modules/your-module-name.ts`
2. Rename `MyModuleConfig`, `MyModuleResult`, and `MyModule`
3. Implement the transform method logic
4. Update the `supportedEventTypes` property

## Template Code

```typescript
import { BaseModule } from "../core/module-base";
import { CloudEvent } from "../utils/cloud-events";

/**
 * Configuration options for this module
 *
 * Define all configuration parameters with appropriate TypeScript types.
 * Use optional properties (?) for parameters with default values.
 * Include detailed JSDoc comments for each property.
 */
export interface MyModuleConfig {
  /**
   * Example boolean configuration option
   */
  enableFeatureX?: boolean;

  /**
   * Example numeric threshold
   */
  threshold?: number;

  /**
   * Example string array option
   */
  allowedValues?: string[];
}

/**
 * Result type specific to this module (if needed)
 *
 * Define structured results that this module will produce.
 * This helps with TypeScript checking and documentation.
 */
export interface MyModuleResult {
  score: number;
  details: string;
  metadata: Record<string, any>;
}

/**
 * Default configuration values
 *
 * Always provide sensible defaults so the module can work
 * with minimal configuration.
 */
const DEFAULT_CONFIG: MyModuleConfig = {
  enableFeatureX: false,
  threshold: 0.5,
  allowedValues: [],
};

/**
 * MyModule implementation
 *
 * Provide a descriptive class comment explaining:
 * - What this module does
 * - When it should be used
 * - How it relates to other modules
 */
export class MyModule extends BaseModule<MyModuleConfig, Record<string, any>> {
  /**
   * Unique name for this module
   * Use kebab-case for consistency
   */
  readonly name = "my-module";

  /**
   * Define which event types this module can process
   * This can be a RegExp (for pattern matching) or string array (for exact matching)
   */
  readonly supportedEventTypes = /com\.(github|google-docs)\..*/;

  /**
   * Constructor
   *
   * Merge provided config with defaults
   */
  constructor(config: MyModuleConfig = {}) {
    super({ ...DEFAULT_CONFIG, ...config });
  }

  /**
   * Transform method - required implementation
   *
   * This method is called for each event that matches supportedEventTypes.
   * It should:
   * 1. Check if processing is needed based on prior results
   * 2. Extract necessary data from the event
   * 3. Process the data
   * 4. Return updated results
   */
  async transform(event: CloudEvent, result: Record<string, any>): Promise<Record<string, any>> {
    // Check if we should skip processing
    // For example, if a previous module has filtered the content
    if (result.filtered === true) {
      return result;
    }

    // Extract data from the event or previous results
    const content = this.extractData(event, result);

    // If no data could be extracted, return unchanged
    if (!content) {
      return result;
    }

    // Process the data - this is where your module's core logic goes
    const moduleResult = this.processData(content);

    // Return augmented results
    return {
      ...result,
      myModule: moduleResult,
    };
  }

  /**
   * Helper method to extract data from an event
   *
   * It's good practice to isolate data extraction logic to handle
   * different event sources consistently.
   */
  private extractData(event: CloudEvent, result: Record<string, any>): string | undefined {
    // First check if data was already extracted by a previous module
    if (result.content) {
      return result.content;
    }

    // Extract based on event data structure
    const data = event.data as any;

    // Extract content based on event type
    // This pattern allows handling different platforms
    if (event.type.includes("github")) {
      return data?.comment?.body || data?.issue?.body;
    } else if (event.type.includes("google-docs")) {
      return data?.document?.content;
    }

    // Generic fallback for other event types
    return data?.content || data?.text;
  }

  /**
   * Core processing logic
   *
   * Keep the transform method clean by moving specific processing
   * logic to dedicated methods.
   */
  private processData(content: string): MyModuleResult {
    // This is where your module's specific logic would go
    // For example, analyzing text, calculating metrics, etc.

    const exampleScore = this.config.enableFeatureX ? 0.8 : 0.5;

    return {
      score: exampleScore,
      details: `Processed ${content.length} characters`,
      metadata: {
        timestamp: new Date().toISOString(),
        configUsed: this.config,
      },
    };
  }
}
