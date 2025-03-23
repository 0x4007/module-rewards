# Foundation Directory Structure

This document outlines the initial directory structure for our new architecture. We'll implement this incrementally to test our assumptions before full migration.

## Initial Structure

```
src/
├── core/                           # Core framework components
│   ├── types.ts                    # Core type definitions
│   ├── module-base.ts              # Base module interface
│   ├── event-router.ts             # Simple event router
│   └── module-chain.ts             # Module chain management
│
├── adapters/                       # Platform adapters
│   ├── adapter-base.ts             # Base adapter interface
│   └── github/                     # Start with GitHub adapter
│       ├── github-adapter.ts       # GitHub webhook adapter
│       └── event-mapper.ts         # Maps GitHub events to CloudEvents
│
├── config/                         # Configuration handling
│   ├── types.ts                    # Configuration type definitions
│   ├── schema.ts                   # JSON schema for config validation
│   └── parser.ts                   # YAML configuration parser
│
├── modules/                        # All modules in one place initially
│   ├── contributor-identifier.ts   # Identifies contributors (former UserExtractor)
│   ├── content-filter.ts           # Filters content (former DataPurge)
│   ├── document-quality.ts         # Scores document quality (former FormattingEvaluator)
│   └── ai-relevance.ts             # AI-based relevance scoring (former ContentEvaluator)
│
├── utils/                          # Shared utilities
│   ├── cloud-events.ts             # CloudEvents utilities
│   └── retry.ts                    # Retry mechanism
│
└── index.ts                        # Main entry point
```

## Implementation Phases

### Phase 1: Core Infrastructure

1. **Basic CloudEvents Support**
   - `src/utils/cloud-events.ts`: Define CloudEvents interface and helper functions
   - `src/core/types.ts`: Define core interfaces used throughout the system

2. **Minimal Module System**
   - `src/core/module-base.ts`: Create basic module interface to process CloudEvents
   - `src/modules/contributor-identifier.ts`: Convert first module as a proof of concept

3. **Simple GitHub Adapter**
   - `src/adapters/adapter-base.ts`: Define adapter interface
   - `src/adapters/github/github-adapter.ts`: Create GitHub webhook adapter

### Phase 2: Configuration System

1. **Basic YAML Parser**
   - `src/config/parser.ts`: Implement YAML configuration parsing
   - `src/config/types.ts`: Define configuration interfaces

2. **Module Chain Execution**
   - `src/core/module-chain.ts`: Create chain execution system
   - `src/core/event-router.ts`: Route events to appropriate chains

3. **Test Configuration Files**
   - Create sample YAML configurations
   - Test parsing and validation

### Phase 3: Incremental Module Migration

Each module will be migrated individually, allowing us to test assumptions:

1. Start with simpler modules like `content-filter.ts`
2. Move to more complex ones like `document-quality.ts`
3. Finally, tackle AI-dependent modules like `ai-relevance.ts`

## File Naming Conventions

- Use **kebab-case** for all filenames
- Use `.ts` extension for TypeScript files
- Group related files in subdirectories
- Use descriptive, consistent naming patterns

## Code Organization Guidelines

1. **Single Responsibility**: Each file should have a clear, single purpose
2. **Interface-First Design**: Define interfaces before implementations
3. **Dependency Injection**: Use constructor injection for dependencies
4. **Export Patterns**: Use named exports, export interfaces from separate files
5. **Type Safety**: Use strong typing throughout

## Testing Strategy

Create corresponding test files for each implementation:

```
src/
├── core/
│   ├── __tests__/
│   │   ├── module-base.test.ts
│   │   └── event-router.test.ts
├── adapters/
│   ├── github/
│   │   ├── __tests__/
│   │   │   └── github-adapter.test.ts
```

## Migration Path

This structure allows us to gradually migrate from the existing system:

1. Start by implementing the core classes and interfaces
2. Create a GitHub adapter compatible with current data
3. Convert one module at a time to the new system
4. Run both systems in parallel, comparing results
5. Gradually shift load to the new system as confidence grows

## Example Implementation Files

### src/core/module-base.ts

```typescript
import { CloudEvent } from '../utils/cloud-events';

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
```

### src/utils/cloud-events.ts

```typescript
/**
 * CloudEvents compliant event structure
 * @see https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md
 */
export interface CloudEvent<T = any> {
  // Required attributes
  specversion: string;
  id: string;
  source: string;
  type: string;

  // Optional attributes
  datacontenttype?: string;
  dataschema?: string;
  subject?: string;
  time?: string;

  // Event data
  data?: T;
}

/**
 * Create a new CloudEvent
 */
export function createCloudEvent<T = any>(params: {
  id: string;
  source: string;
  type: string;
  data?: T;
  subject?: string;
  datacontenttype?: string;
}): CloudEvent<T> {
  return {
    specversion: '1.0',
    id: params.id,
    source: params.source,
    type: params.type,
    time: new Date().toISOString(),
    datacontenttype: params.datacontenttype || 'application/json',
    subject: params.subject,
    data: params.data
  };
}
